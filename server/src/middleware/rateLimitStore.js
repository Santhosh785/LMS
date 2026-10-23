import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import pg from 'pg'
import { env } from '../config/env.js'
import { captureMessage } from '../config/observability.js'

/**
 * Shared Postgres store for the express-rate-limit limiters.
 *
 * With the default MemoryStore every process keeps its own counters, so N
 * instances meant N buckets and N times the allowed login attempts. Here every
 * process counts in one table, so the sixth attempt is refused whichever
 * process answers it.
 *
 * The schema and the counting SQL are @acpr/rate-limit-postgresql's aggregated
 * store: its migrations create `rate_limit.*`, and `increment` calls its
 * `rate_limit.agg_increment` the same way its `PostgresStore` does. The class
 * itself is not used, for four reasons that each bite in this deployment:
 *
 *  1. Its constructor starts its migrations without awaiting or catching them,
 *     so an unreachable database at boot is seven unhandled rejections.
 *  2. Those migrations go through postgres-migrations, which takes a
 *     *session* advisory lock and releases it in a later statement. Through
 *     Supabase's transaction pooler the two statements can land on different
 *     backends, leaking the lock on one of them.
 *  3. postgres-migrations keeps its ledger in an unqualified `migrations` table
 *     and checks for it by name in *any* schema. Supabase already has
 *     `storage.migrations`, so the check passes, the unqualified SELECT fails,
 *     and the schema is never created.
 *  4. It `console.error`s every failed query and opens a pool per store — seven
 *     pools, and one log line per request while the database is down.
 *
 * So the bootstrap below applies the same migration files in one transaction
 * under a transaction-scoped advisory lock (safe through the pooler), and the
 * store queries a single small pool with connect and query timeouts, throwing
 * without logging so the caller can report on its own terms.
 */

/* ---------------------------------- pool ---------------------------------- */

let sharedPool = null

/**
 * One small pool for all seven limiters, separate from the application pool.
 *
 * Separate because `agg_increment` takes a table lock: a slow rate-limit query
 * must not hold one of the ten connections the actual requests need. And with
 * timeouts, because pg's default is to wait forever — an unreachable database
 * would then hang every login instead of failing open.
 */
export function getRateLimitPool() {
  if (!sharedPool) {
    sharedPool = new pg.Pool({
      connectionString: env.databaseUrl,
      max: 3,
      connectionTimeoutMillis: 5_000,
      query_timeout: 5_000,
      idleTimeoutMillis: 30_000,
      allowExitOnIdle: true,
      // Same TLS rule as db/index.js: Supabase's pooler certificate is not in
      // Node's default store, and the connection string pins the host.
      ssl: env.databaseUrl.includes('supabase') ? { rejectUnauthorized: false } : undefined,
    })
    // An idle client losing its connection emits here; unhandled, it would
    // crash the process.
    sharedPool.on('error', (err) => reportStoreError(err, { source: 'idle pool client' }))
  }
  return sharedPool
}

/* -------------------------------- bootstrap ------------------------------- */

const requireCjs = createRequire(import.meta.url)
const MIGRATIONS_DIR = path.join(
  path.dirname(requireCjs.resolve('@acpr/rate-limit-postgresql')),
  'migrations',
)

/** Arbitrary, fixed: serialises the bootstrap across every process. */
const BOOTSTRAP_LOCK = 7_209_331_406

/** The last migration's function, with its final four-argument signature. */
const READY_SQL = `
  select exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'rate_limit' and p.proname = 'agg_increment' and p.pronargs = 4
  ) as ready`

const CREATE_SCHEMA = /^\s*CREATE SCHEMA IF NOT EXISTS rate_limit;\s*$/im

/**
 * The package's migrations, in order. When an admin has already created the
 * schema, its CREATE SCHEMA line is dropped: Postgres checks the database-level
 * CREATE privilege even for IF NOT EXISTS on a schema that exists, and a role
 * granted only the schema itself does not hold it.
 */
function migrationFiles({ schemaExists }) {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d+-.*\.sql$/.test(f))
    .sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
    .map((f) => fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8'))
    .map((sql) => (schemaExists ? sql.replace(CREATE_SCHEMA, '') : sql))
}

/**
 * Creates `rate_limit.*` on first use. Needs a role that may create the schema,
 * or one that owns (or may create in) a schema an admin created for it — see
 * docs/deploy.md.
 *
 * One transaction, so it pins one backend even through the transaction pooler,
 * and either everything exists afterwards or nothing does. Concurrent processes
 * queue on `pg_advisory_xact_lock`, which is released by COMMIT on the same
 * backend, and the second one finds the schema already there.
 */
async function bootstrap(pool) {
  const client = await pool.connect()
  let broken
  try {
    if ((await client.query(READY_SQL)).rows[0].ready) return
    await client.query('begin')
    try {
      await client.query('select pg_advisory_xact_lock($1)', [BOOTSTRAP_LOCK])
      if (!(await client.query(READY_SQL)).rows[0].ready) {
        const { rows } = await client.query(
          "select to_regnamespace('rate_limit') is not null as exists",
        )
        for (const sql of migrationFiles({ schemaExists: rows[0].exists })) {
          await client.query(sql)
        }
      }
      await client.query('commit')
    } catch (err) {
      await client.query('rollback').catch((rollbackErr) => {
        broken = rollbackErr
      })
      throw err
    }
  } finally {
    // A connection that could not even roll back is discarded, not reused.
    client.release(broken)
  }
}

const bootstraps = new WeakMap()

/** Once per pool; a failure is forgotten so the next request tries again. */
export function ensureRateLimitSchema(pool = getRateLimitPool()) {
  let pending = bootstraps.get(pool)
  if (!pending) {
    pending = bootstrap(pool).catch((err) => {
      bootstraps.delete(pool)
      throw err
    })
    bootstraps.set(pool, pending)
  }
  return pending
}

/* ---------------------------------- store --------------------------------- */

/**
 * express-rate-limit Store over the package's aggregated schema.
 *
 * `prefix` is the package's session name: each limiter's counters live in their
 * own session row, so two limiters never share a bucket even for the same key.
 * Its window is per prefix (a fixed window that starts on the first hit after
 * the previous one expired), which is the package's semantics.
 */
export class PostgresRateLimitStore {
  /** Keys are shared with every other process — that is the point. */
  localKeys = false

  constructor({ prefix, pool } = {}) {
    if (!prefix) throw new Error('PostgresRateLimitStore needs a prefix')
    this.prefix = prefix
    this.pool = pool
  }

  init(options) {
    this.windowMs = options.windowMs
  }

  async #query(text, values) {
    const pool = this.pool ?? getRateLimitPool()
    await ensureRateLimitSchema(pool)
    return pool.query(text, values)
  }

  async increment(key) {
    const { rows } = await this.#query(
      'select * from rate_limit.agg_increment($1, $2, $3) as (count int, expires_at timestamptz)',
      [key, this.prefix, this.windowMs],
    )
    return {
      totalHits: rows.length ? Number(rows[0].count) : 0,
      resetTime: rows.length ? rows[0].expires_at : undefined,
    }
  }

  async decrement(key) {
    await this.#query('select rate_limit.agg_decrement($1, $2)', [key, this.prefix])
  }

  async resetKey(key) {
    await this.#query('select rate_limit.agg_reset_key($1, $2)', [key, this.prefix])
  }

  async resetAll() {
    await this.#query('select rate_limit.agg_reset_session($1)', [this.prefix])
  }
}

/* -------------------------------- reporting ------------------------------- */

/**
 * At most one report per `intervalMs`, however many requests fail.
 *
 * Every limited request touches the store, so a database outage produces one
 * error per login, checkout and comment. Reporting each would flood the log and
 * the error tracker with copies of the one fact that matters; instead the next
 * report carries how many were dropped since the last.
 */
export function createThrottledReporter({
  intervalMs = 60_000,
  now = Date.now,
  sink = captureMessage,
} = {}) {
  let lastAt = -Infinity
  let suppressed = 0
  return function report(err, detail = {}) {
    const at = now()
    if (at - lastAt < intervalMs) {
      suppressed += 1
      return false
    }
    lastAt = at
    const context = {
      ...detail,
      error: err?.message ?? String(err),
      code: err?.code,
      suppressedSinceLastReport: suppressed,
    }
    suppressed = 0
    try {
      sink('Rate-limit store error — requests are passing without a limit', context)
    } catch {
      // Reporting must never be the thing that breaks a request.
    }
    return true
  }
}

/** One throttle shared by every limiter and the pool. */
export const reportStoreError = createThrottledReporter()

/**
 * The limiters' `logger`. express-rate-limit logs a store error on every
 * request it lets through under `passOnStoreError`; those go to the throttled
 * reporter. Its own ERR_ERL_* validation messages are configuration bugs and
 * stay on the console, as with the default logger.
 */
export function limiterLogger(limiter, report = reportStoreError) {
  return {
    warn: (...args) => console.warn(...args.reverse()),
    error: (err, message) => {
      if (String(err?.code ?? '').startsWith('ERR_ERL_')) {
        console.error(...[err, message].filter(Boolean).reverse())
        return
      }
      report(err, { limiter, message })
    },
  }
}
