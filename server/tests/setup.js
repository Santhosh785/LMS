import mongoose from 'mongoose'
import { afterAll, beforeAll, beforeEach } from 'vitest'

/**
 * Test environment.
 *
 * Everything is set **before** any application module is imported, because
 * `config/env.js` reads `process.env` once at import time. Anything set later is
 * simply ignored, which is a confusing hour to spend.
 */
process.env.NODE_ENV = 'test'
process.env.JWT_SECRET = 'test-only-jwt-secret-not-used-anywhere-real'
process.env.MONGO_URI =
  process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/growth-scholar-test'

// Fixed, obviously fake credentials. Real ones must never reach a test run.
process.env.BUNNY_LIBRARY_ID = '999999'
process.env.BUNNY_SECURITY_KEY = 'test-bunny-security-key'
process.env.BUNNY_API_KEY = 'test-bunny-api-key'
process.env.BUNNY_WEBHOOK_TOKEN = 'test-bunny-webhook-token'
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

/**
 * The guard that makes "isolated" true rather than aspirational.
 *
 * The seeder once deleted 27 collections with no environment check, and task 3
 * exists because that boundary was unenforced. A test suite that calls
 * `dropDatabase()` between every test is exactly as dangerous, so it refuses to
 * run against anything not explicitly named as a test database.
 */
const dbName = new URL(process.env.MONGO_URI.replace(/^mongodb\+srv:/, 'mongodb:')).pathname.slice(
  1,
)
if (!/-test$/.test(dbName)) {
  throw new Error(
    `Refusing to run tests against "${dbName}" — the database name must end in "-test". ` +
      'Set TEST_MONGO_URI to something like mongodb://127.0.0.1:27017/growth-scholar-test.',
  )
}

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI)
  // Indexes are behaviour under test — the unique UTR index, the partial
  // workshop indexes, the unique razorpayPaymentId — so they must exist.
  const { default: models } = await import('./helpers/models.js')
  await Promise.all(Object.values(models).map((m) => m.syncIndexes()))
})

beforeEach(async () => {
  const collections = await mongoose.connection.db.collections()
  await Promise.all(collections.map((c) => c.deleteMany({})))

  /**
   * The settings and taxonomy caches are process state, not database state, so
   * wiping the collections leaves them holding rows that no longer exist. In
   * production they are invalidated by the admin write that caused the change;
   * a test that seeds a document directly has no such write, and would other-
   * wise be served a previous test's payload from GET /api/config.
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
})

afterAll(async () => {
  await mongoose.connection.dropDatabase()
  await mongoose.disconnect()
})
