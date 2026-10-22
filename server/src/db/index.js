import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { env } from '../config/env.js'
import * as schema from './schema/index.js'

// numeric arrives as a string by default; the schema's money() columns ask for
// numbers, but aggregates like sum(amount) come back raw. Parse them once here
// so every report sees numbers, as it did with Mongo.
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (v) => (v === null ? null : Number(v)))
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => (v === null ? null : Number(v)))

/**
 * One pool for the process. Through Supabase's transaction-mode pooler a
 * connection is only ours for the duration of a transaction, so nothing here may
 * rely on session state (SET, prepared statements, advisory session locks).
 */
export const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  max: 10,
  // Supabase requires TLS; its pooler certificate is not in Node's default
  // store, and the connection string already pins the host.
  ssl: env.databaseUrl.includes('supabase') ? { rejectUnauthorized: false } : undefined,
})

export const db = drizzle({ client: pool, schema, casing: 'snake_case' })

/**
 * Runs `fn` in a transaction and returns its result. Anything thrown rolls the
 * whole unit back — the point of the migration for the money paths, where a
 * half-applied fulfilment (paid, but no enrollment) was possible under Mongo.
 */
export const withTx = (fn) => db.transaction(fn)

/**
 * Runs query thunks concurrently on the pool, but one after another on a
 * transaction. A transaction is a single connection; issuing queries on it in
 * parallel only queues them inside `pg`, which pg 9 turns from a deprecation
 * warning into an error. Same results either way, in input order.
 */
export async function inParallel(conn, thunks) {
  if (conn === db) return Promise.all(thunks.map((run) => run()))
  const results = []
  for (const run of thunks) results.push(await run())
  return results
}

/**
 * The API contract predates Postgres: the client reads `_id` in some 250
 * places. Rather than rewrite them, responses keep exposing the uuid as `_id`
 * alongside `id`.
 */
export function withMongoId(row) {
  if (row === null || row === undefined) return row
  if (Array.isArray(row)) return row.map(withMongoId)
  if (typeof row !== 'object' || row instanceof Date) return row
  const out = {}
  for (const [k, v] of Object.entries(row)) {
    out[k] = v && typeof v === 'object' && !(v instanceof Date) ? withMongoId(v) : v
  }
  if ('id' in row && !('_id' in row)) out._id = row.id
  return out
}

export async function closeDb() {
  await pool.end()
}

export { schema }
