/**
 * Runs a command while holding the database advisory lock the test suite uses.
 *
 *   node scripts/with-db-lock.js [--wipe-after] -- <command> [args…]
 *
 * The dev/test Supabase project is shared: the test suite truncates every table
 * between tests, and holds session advisory lock 7370042 for the life of each
 * test file so concurrent runs serialise. Anything else that writes to that
 * project — a seed rehearsal, an ETL dry run — takes the same lock, so neither
 * side wipes the other's data mid-flight.
 *
 * `--wipe-after` deletes every auth identity and truncates every public table
 * before releasing, leaving the project as empty as the tests expect. Refuses
 * unless the configured project is the declared test project.
 */
import { spawn } from 'node:child_process'
import pg from 'pg'
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core'
import { env } from '../src/config/env.js'
import * as schema from '../src/db/schema/index.js'

const LOCK_KEY = 7_370_042

const argv = process.argv.slice(2)
const sep = argv.indexOf('--')
const flags = sep === -1 ? argv : argv.slice(0, sep)
const command = sep === -1 ? [] : argv.slice(sep + 1)
const wipeAfter = flags.includes('--wipe-after')

if (!command.length) {
  console.error('usage: node scripts/with-db-lock.js [--wipe-after] -- <command> [args…]')
  process.exit(1)
}
if (wipeAfter && env.supabase.projectRef !== process.env.TEST_SUPABASE_PROJECT_REF) {
  console.error('[lock] refusing --wipe-after: this is not the declared test project')
  process.exit(1)
}

const TABLES = Object.values(schema)
  .filter((v) => v instanceof PgTable)
  .map((t) => `"${getTableConfig(t).name}"`)
  .join(', ')

const client = new pg.Client({
  connectionString: env.directDatabaseUrl,
  ssl: { rejectUnauthorized: false },
})
await client.connect()
// Supabase's default statement_timeout (~2 min) would cancel the wait while a
// long test file holds the lock; this session only ever waits and wipes.
await client.query('set statement_timeout = 0')
console.log('[lock] waiting for the shared database lock…')
await client.query('select pg_advisory_lock($1)', [LOCK_KEY])
console.log('[lock] acquired')

let code = 1
try {
  code = await new Promise((resolve) => {
    const child = spawn(command[0], command.slice(1), { stdio: 'inherit' })
    child.on('exit', (c) => resolve(c ?? 1))
    child.on('error', () => resolve(1))
  })
} finally {
  if (wipeAfter) {
    await client.query(`delete from auth.users; truncate ${TABLES} restart identity cascade`)
    console.log('[lock] wiped the test project')
  }
  await client.query('select pg_advisory_unlock($1)', [LOCK_KEY])
  await client.end()
}
process.exit(code)
