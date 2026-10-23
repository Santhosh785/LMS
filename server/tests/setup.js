import { afterAll, beforeAll, beforeEach } from 'vitest'

/**
 * Test environment.
 *
 * Everything is set **before** any application module is imported, because
 * `config/env.js` reads `process.env` once at import time. Anything set later is
 * simply ignored, which is a confusing hour to spend.
 *
 * Unlike the Mongo era there is no local database: the suite runs against the
 * dedicated Supabase test project named by TEST_SUPABASE_PROJECT_REF, with the
 * Supabase credentials from server/.env. Those are read here, before NODE_ENV
 * changes, because the test values below must not be overridden by .env.
 */
const dotenv = await import('dotenv')
dotenv.config({ quiet: true })

process.env.NODE_ENV = 'test'

// Fixed, obviously fake credentials. Real ones must never reach a test run.
process.env.BUNNY_LIBRARY_ID = '999999'
process.env.BUNNY_SECURITY_KEY = 'test-bunny-security-key'
process.env.BUNNY_API_KEY = 'test-bunny-api-key'
process.env.BUNNY_WEBHOOK_TOKEN = 'test-bunny-webhook-token'
/*
 * Blank, not fake. These are read by services/bunnyStorage.js, which makes a
 * real PUT to a real storage zone — so unlike the Stream values above, a
 * placeholder is not enough: a developer with working credentials in their
 * .env would otherwise have the suite write test images into production
 * storage. Blank means "not configured", and the storage tests opt in by
 * writing the settings row themselves.
 */
process.env.BUNNY_STORAGE_ZONE = ''
process.env.BUNNY_STORAGE_PASSWORD = ''
process.env.BUNNY_STORAGE_REGION = ''
process.env.BUNNY_STORAGE_HOST = ''
process.env.UPI_VPA = 'test@okbank'
process.env.UPI_PAYEE_NAME = 'Growth Scholar Test'
process.env.RAZORPAY_KEY_ID = 'rzp_test_key'
process.env.RAZORPAY_KEY_SECRET = 'test-razorpay-key-secret'
process.env.RAZORPAY_WEBHOOK_SECRET = 'test-razorpay-webhook-secret'
// Left unset on purpose: the mail layer must no-op, and a test run must never
// be able to send a real email to a real person.
process.env.RESEND_API_KEY = ''
process.env.MAIL_FROM = ''
process.env.SENTRY_DSN = ''
// Blank for the same reason: every admin content write queues a Cloudflare
// purge, and with real values in .env the suite would purge the live zone.
process.env.CF_ZONE_ID = ''
process.env.CF_API_TOKEN = ''
process.env.CONFIG_SECRET = 'test-only-config-secret-not-used-anywhere-real'

/**
 * The guard that makes "isolated" true rather than aspirational.
 *
 * The seeder once deleted 27 collections with no environment check, and task 3
 * exists because that boundary was unenforced. This suite truncates every table
 * and deletes every auth identity between tests, so it refuses to run unless the
 * configured project is the one explicitly named as the test project.
 */
const ref = process.env.SUPABASE_PROJECT_REF
const testRef = process.env.TEST_SUPABASE_PROJECT_REF
if (!ref || !testRef || ref !== testRef) {
  throw new Error(
    `Refusing to run tests: SUPABASE_PROJECT_REF (${ref || 'unset'}) must equal ` +
      `TEST_SUPABASE_PROJECT_REF (${testRef || 'unset'}). The suite wipes the database it ` +
      'runs against — point it at the dedicated test project only.',
  )
}
if (!process.env.DATABASE_URL?.includes(testRef)) {
  throw new Error('Refusing to run tests: DATABASE_URL does not point at the test project.')
}

const pg = (await import('pg')).default
const { getTableConfig, PgTable } = await import('drizzle-orm/pg-core')
const schema = await import('../src/db/schema/index.js')

const TABLES = Object.values(schema)
  .filter((v) => v instanceof PgTable)
  .map((t) => `"${getTableConfig(t).name}"`)
  .join(', ')

/**
 * One shared remote database, possibly several concurrent `vitest` runs (each
 * single-fork, but not aware of each other). A session-level advisory lock held
 * for the life of each test file serialises them, so one run's TRUNCATE can
 * never land in the middle of another run's test. It needs a session, hence the
 * direct (session-mode) connection rather than the app's transaction pooler.
 */
const LOCK_KEY = 7_370_042
let lockClient
/**
 * Whether this file actually holds the lock. Nothing below may wipe without it:
 * if `beforeAll` times out, Vitest carries on to the hooks while the lock query
 * is still pending, and an unconditional wipe then empties another run's data
 * mid-test.
 */
let locked = false

const WIPE = `delete from auth.users; truncate ${TABLES} restart identity cascade`

beforeAll(async () => {
  lockClient = new pg.Client({
    connectionString: process.env.DIRECT_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })
  await lockClient.connect()
  // Supabase's postgres role cancels statements after ~2 minutes, and waiting
  // for the lock is one statement. Lift the limit for this connection only.
  await lockClient.query('set statement_timeout = 0')
  await lockClient.query('select pg_advisory_lock($1)', [LOCK_KEY])
  locked = true
}, 15 * 60_000)

beforeEach(async () => {
  // auth.users first: deleting an identity cascades to its profile row, and
  // TRUNCATE ... CASCADE then clears everything else in one statement.
  if (!locked) throw new Error('Test database lock not held — refusing to wipe')
  await lockClient.query(WIPE)

  /**
   * The settings and taxonomy caches are process state, not database state, so
   * wiping the tables leaves them holding rows that no longer exist. In
   * production they are invalidated by the admin write that caused the change;
   * a test that seeds a row directly has no such write, and would otherwise be
   * served a previous test's payload from GET /api/config.
   *
   * Imported here rather than at the top of the file because the module graph
   * must not load before the environment above is set.
   */
  const [{ invalidateSiteConfig }, { invalidateRuntimeConfig }] = await Promise.all([
    import('../src/services/siteConfig.js'),
    import('../src/services/runtimeConfig.js'),
  ])
  invalidateSiteConfig()
  invalidateRuntimeConfig()
}, 60_000)

afterAll(async () => {
  try {
    if (locked) {
      await lockClient.query(WIPE)
      await lockClient.query('select pg_advisory_unlock($1)', [LOCK_KEY])
    }
  } finally {
    // Ending the connection also abandons a lock wait that never completed.
    await lockClient?.end().catch(() => {})
    const { closeDb } = await import('../src/db/index.js')
    await closeDb()
  }
}, 60_000)
