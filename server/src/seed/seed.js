/**
 * Growth Scholar seeder — one entry point, two clearly separated operations.
 *
 *   content   idempotent catalogue publish. Upserts courses, programs,
 *             workshops, blog posts, channels, practice items, badges, point
 *             rules and the settings singleton by natural key. Deletes nothing,
 *             and never touches accounts, enrollments, payments or
 *             certificates. Safe to run against production, repeatedly.
 *
 *   demo      the fabricated dataset — demo accounts, enrollments,
 *             certificates, transactions, customers, leads, bookings, community
 *             posts, leaderboards. WIPES those collections first, so it refuses
 *             to run when NODE_ENV=production unless the exact override flag is
 *             given.
 *
 *   all       content, then demo. The one command for a fresh dev database.
 *
 * `node src/seed/seed.js --help` prints the same usage the operator needs.
 */
import mongoose from 'mongoose'
import { connectDb, disconnectDb } from '../config/db.js'
import { seedContent } from './content.js'
import { seedSample } from './sample.js'
import { seedDemo, DEMO_COLLECTIONS } from './demo.js'
import {
  auditProduction,
  draftUndeliverableCourses,
  ensureAdmin,
  productionAdminEmail,
  resetInventedStats,
} from './production.js'
import {
  assertDestructiveAllowed,
  describeTarget,
  error,
  log,
  OVERRIDE_FLAG,
  requireSeedPassword,
} from './guard.js'
import { cfg } from '../services/runtimeConfig.js'

const COMMANDS = ['content', 'demo', 'all', 'admin', 'audit', 'prepare', 'sample']
const KNOWN_FLAGS = ['--keep-users', '--help', '-h', '--dry-run', OVERRIDE_FLAG]

const USAGE = `
Growth Scholar seeder

  npm run seed                 publish catalogue content (safe, idempotent)
  npm run seed:demo            wipe + rebuild the demo dataset (development only)
  npm run seed:all             content, then demo — a full local dataset

Going live (task 13)
  npm run seed                 1. publish the catalogue
  npm run seed:admin           2. create the one real operator account
  npm run seed:prepare         3. zero the invented stats, draft what has no video
  npm run seed:audit           4. prove no fabricated data reached this database

Commands
  content   Upsert courses, programs, workshops, blog posts, channels, practice
            items, badges, point rules and settings by natural key. Deletes
            nothing. Leaves User, Enrollment, Transaction, Customer and
            Certificate documents untouched. Safe against production.
  demo      DESTRUCTIVE. Deletes every document in:
              ${DEMO_COLLECTIONS.join(', ')}
            then recreates the demo accounts and their data. Requires
            SEED_PASSWORD (>= 8 chars) in the environment; the password is never
            printed. Needs the catalogue to exist already.
  all       content followed by demo. Same destructive rules as demo.
  admin     Create the single real operator account, or reset its password to
            SEED_PASSWORD. Address comes from ADMIN_EMAIL. Touches no other
            account and creates no demo data. Safe against production.
  sample    Content, then publish it — the preview switch. Use it to look at
            the design on a local or staging database: the content seed creates
            courses as Draft (no video attached), so a fresh database otherwise
            renders an empty catalogue. Refuses under NODE_ENV=production.

  audit     READ-ONLY. Reports demo accounts, invented ratings and enrolment
            counts, courses published without video, and prices. Exits non-zero
            when it finds a problem, so it can gate a deploy.
  prepare   Zero the invented rating/enrolment figures (recomputing counts from
            real enrolments) and move any Published course whose lessons have no
            video attached to Draft. Never promotes a course to Published — that
            stays a human decision. Touches no customer data.

Flags
  --keep-users            demo/all: keep existing User documents instead of
                          deleting them, reusing any account whose email matches
                          a demo account.
  --dry-run               prepare: report what would change and change nothing.
  ${OVERRIDE_FLAG}   demo/all: the ONLY way to run a destructive seed
                          while NODE_ENV=production. Must be typed exactly.
                          There is no short form and no environment variable.
  --help, -h              print this and exit.

Without that flag, a destructive seed under NODE_ENV=production exits non-zero
before opening a database connection, naming the database it refused to destroy.
`

const argv = process.argv.slice(2)
const flags = argv.filter((a) => a.startsWith('-'))
const positional = argv.filter((a) => !a.startsWith('-'))

if (flags.includes('--help') || flags.includes('-h')) {
  console.log(USAGE)
  process.exit(0)
}

// An unrecognised flag is usually a mistyped one. Refuse rather than silently
// ignoring it — a near-miss on the override flag must never look like a pass.
const unknown = flags.filter((f) => !KNOWN_FLAGS.includes(f))
if (unknown.length) {
  error(`unknown flag(s): ${unknown.join(', ')}`)
  console.error(USAGE)
  process.exit(1)
}

if (positional.length > 1 || (positional[0] && !COMMANDS.includes(positional[0]))) {
  error(`unknown command: ${positional.join(' ')}`)
  console.error(USAGE)
  process.exit(1)
}

// Default to the safe half. `npm run seed` must never be the destructive one.
const command = positional[0] || 'content'
const keepUsers = flags.includes('--keep-users')
const destructive = command === 'demo' || command === 'all'

/* ---------------- everything below the line runs pre-connect -------------- */
let seedPassword = ''
if (destructive) {
  assertDestructiveAllowed(flags, { command, destroys: DEMO_COLLECTIONS })
  seedPassword = requireSeedPassword()
} else if (command === 'admin') {
  // Creating the operator account is the one non-destructive path that still
  // needs the password, so it is demanded here rather than after connecting.
  seedPassword = requireSeedPassword()
  log(`admin: about to create or repair ${productionAdminEmail()} in ${describeTarget()}`)
} else if (command === 'audit') {
  log(`audit: read-only inspection of ${describeTarget()}`)
} else {
  log(`${command}: about to modify content in ${describeTarget()}`)
}

let exitCode = 0

async function run() {
  await connectDb()

  if (command === 'content' || command === 'all' || command === 'sample') await seedContent()
  if (command === 'sample') await seedSample()
  if (command === 'demo' || command === 'all') await seedDemo({ seedPassword, keepUsers })

  if (command === 'admin') {
    await ensureAdmin({
      email: productionAdminEmail(),
      name: cfg.business.name,
      password: seedPassword,
    })
    log('admin: sign in and change this password, or use Forgot password to set your own')
  }

  if (command === 'prepare') {
    await resetInventedStats()
    await draftUndeliverableCourses({ dryRun: flags.includes('--dry-run') })
    log('prepare complete — run `npm run seed:audit` to confirm')
  }

  if (command === 'audit') {
    const { ok } = await auditProduction({ adminEmail: productionAdminEmail() })
    // Non-zero so this can gate a deploy rather than being read by eye.
    if (!ok) exitCode = 1
  }

  if (command === 'sample') {
    log('sample complete — open the public site; every catalogue page now has content')
  }

  if (command === 'content') {
    log('for demo accounts and sample activity, run: npm run seed:demo')
  }

  await disconnectDb()
}

run()
  .then(() => process.exit(exitCode))
  .catch(async (err) => {
    error('failed:', err.message || err)
    if (!err.message) console.error(err)
    await mongoose.disconnect().catch(() => {})
    process.exit(1)
  })
