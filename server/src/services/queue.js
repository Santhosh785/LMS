import { PgBoss } from 'pg-boss'
import { env } from '../config/env.js'
import { captureMessage } from '../config/observability.js'

/**
 * Durable background jobs on pg-boss, stored in the app's own Postgres (schema
 * `pgboss`) and worked inside this Express process. See docs/jobs.md.
 *
 * Call sites never talk to pg-boss directly. They `enqueue(name, data)` a job
 * that was `defineJob`-ed at import time, and the module decides where it runs:
 *
 *   - queue started  -> stored in Postgres, worked by this process, retried with
 *                       exponential backoff when the handler throws.
 *   - not started    -> the handler runs inline and `enqueue` resolves or rejects
 *                       with its outcome. That is the case under test, with
 *                       BOSS_ENABLED=0, and in the moments before boot has
 *                       finished starting the queue — so turning the queue off
 *                       is a restart, not a code change.
 */

const SCHEMA = 'pgboss'
// pg-boss holds a LISTEN connection plus polling/maintenance work; three is
// plenty for one process and keeps it well clear of Supabase's connection cap.
const POOL_MAX = 3
const STOP_TIMEOUT_MS = 30_000

/**
 * Applied to every send unless the caller overrides them. With `retryBackoff`
 * the delay doubles per attempt (with jitter) from `retryDelay` seconds, so five
 * retries span roughly 5s, 10s, 20s, 40s, 80s — long enough to ride out a
 * provider blip, short enough that a buyer is not waiting an hour for an email.
 */
const SEND_DEFAULTS = Object.freeze({
  retryLimit: 5,
  retryBackoff: true,
  retryDelay: 5,
  retryDelayMax: 600,
})

/** name -> { handler, queueOptions, workOptions } */
const registry = new Map()

let boss = null
let started = false
let starting = null

/* -------------------------------- registry -------------------------------- */

/**
 * Registers a job. `handler(data)` receives the job's data payload — never the
 * pg-boss wrapper or an array — and its resolved value becomes the job's output.
 * Throwing (or rejecting) fails the attempt so pg-boss retries it.
 *
 * `queueOptions` go to `createQueue` (policy, retention, dead letter…) and only
 * take effect when the queue is first created; `workOptions` go to `work`
 * (polling interval…), with the batch size pinned to 1.
 */
export function defineJob(name, { handler, queueOptions = {}, workOptions = {} } = {}) {
  if (typeof name !== 'string' || !name) throw new Error('defineJob: a job name is required')
  if (typeof handler !== 'function') {
    throw new Error(`defineJob("${name}"): handler must be a function`)
  }
  if (registry.has(name)) throw new Error(`defineJob: job "${name}" is already defined`)
  if (started || starting) {
    throw new Error(`defineJob("${name}"): jobs must be defined before startQueue() runs`)
  }
  registry.set(name, { handler, queueOptions, workOptions })
}

function lookup(name) {
  const job = registry.get(name)
  if (!job) throw new Error(`Unknown job "${name}" — define it with defineJob() first`)
  return job
}

/** Whether jobs currently go to Postgres rather than running inline. */
export function isQueueStarted() {
  return started
}

/* ------------------------------- lifecycle -------------------------------- */

/**
 * Starts pg-boss and one worker per defined job. A no-op when the queue is
 * disabled or under test (`allowInTest` lifts the test guard for the
 * integration test only — it never touches BOSS_ENABLED). Safe to call twice.
 */
export async function startQueue({ allowInTest = false } = {}) {
  if (started) return
  if (starting) return starting
  if (!env.boss.enabled) {
    console.log('[queue] BOSS_ENABLED=0 — jobs run inline')
    return
  }
  if (env.isTest && !allowInTest) return

  starting = boot().finally(() => {
    starting = null
  })
  return starting
}

async function boot() {
  const connectionString = env.boss.databaseUrl
  if (!connectionString) throw new Error('BOSS_DATABASE_URL (or DIRECT_DATABASE_URL) is not set')

  const instance = new PgBoss({
    connectionString,
    schema: SCHEMA,
    max: POOL_MAX,
    application_name: 'growth-scholar-queue',
    // Same TLS handling as the Drizzle pool in db/index.js.
    ssl: connectionString.includes('supabase') ? { rejectUnauthorized: false } : undefined,
  })
  // Without a listener an `error` event is thrown by EventEmitter and takes
  // the process down; pg-boss emits them for transient maintenance failures.
  instance.on('error', (err) => {
    captureMessage('Job queue error', { error: err?.message, stack: err?.stack })
  })
  instance.on('warning', (warning) => {
    console.warn('[queue] warning:', warning?.message ?? warning)
  })

  try {
    await instance.start()
    // pg-boss 10+ throws on send/work against a queue that does not exist,
    // so every queue is created (idempotently) before any worker registers.
    for (const [name, { queueOptions }] of registry) {
      await instance.createQueue(name, queueOptions)
    }
    for (const [name, { handler, workOptions }] of registry) {
      await instance.work(name, { ...workOptions, batchSize: 1 }, (jobs) =>
        runHandler(name, handler, jobs),
      )
    }
  } catch (err) {
    await instance.stop({ graceful: false, timeout: 1000 }).catch(() => {})
    throw err
  }

  boss = instance
  started = true
  console.log(`[queue] started — ${registry.size} job type(s): ${[...registry.keys()].join(', ')}`)
}

/**
 * pg-boss v12 hands workers an array even at batch size 1. Unwrap it so every
 * handler sees exactly one data payload, the same thing it gets inline.
 */
async function runHandler(name, handler, jobs) {
  const list = Array.isArray(jobs) ? jobs : [jobs]
  let result
  for (const job of list) {
    try {
      result = await handler(job.data)
    } catch (err) {
      console.error(
        `[queue] job ${name} ${job.id} failed (attempt ${job.retryCount + 1}):`,
        err?.message,
      )
      throw err
    }
  }
  return result
}

/**
 * Graceful stop: no new jobs are fetched and in-flight handlers get up to 30
 * seconds to finish. Enqueues from this point on run inline. Safe to call when
 * the queue never started.
 */
export async function stopQueue() {
  if (starting) await starting.catch(() => {})
  const instance = boss
  started = false
  boss = null
  if (!instance) return
  await instance.stop({ graceful: true, timeout: STOP_TIMEOUT_MS })
  console.log('[queue] stopped')
}

/* --------------------------------- sending -------------------------------- */

/**
 * Queues `name` with `data`. Options pass straight through to pg-boss `send`
 * (`singletonKey`, `startAfter`, `retryLimit`, `priority`…) over the retry
 * defaults above. Resolves with the job id — or `null` when a singleton key
 * deduplicated it.
 *
 * Inline (queue not started) it resolves with the handler's result or rejects
 * with its error, and scheduling options are ignored.
 */
export async function enqueue(name, data = {}, options = {}) {
  const { handler } = lookup(name)
  if (!started) return handler(data)
  return boss.send(name, data, sendOptions(options))
}

/**
 * Registers (or replaces) a cron schedule for a defined job. Call it after
 * `startQueue()`; inline there is no scheduler, so it is a no-op.
 */
export async function schedule(name, cron, data = {}, options = {}) {
  lookup(name)
  if (!started) return
  await boss.schedule(name, cron, data, sendOptions(options))
}

/** Caller options over the defaults; the backoff cap only applies with backoff on. */
function sendOptions(options) {
  const merged = { ...SEND_DEFAULTS, ...options }
  if (merged.retryBackoff !== true && !('retryDelayMax' in options)) delete merged.retryDelayMax
  return merged
}
