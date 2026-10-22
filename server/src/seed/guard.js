/**
 * Safety rails shared by every seed entry point.
 *
 * The seeder used to delete 27 collections unconditionally, so a single
 * `npm run seed` with a production MONGO_URI in the shell wiped enrollments,
 * transactions, customers and certificates. Everything here runs *before*
 * connectDb(), so a refused run never opens a connection, let alone deletes.
 */
import { env } from '../config/env.js'
// Shared with config/db.js so the boot log and the seeder redact identically.
// Imported as well as re-exported: `assertDestructiveAllowed` below calls it.
import { describeTarget } from '../utils/dbTarget.js'
export { describeTarget }

/** Deliberately long and awkward: nobody types this by muscle memory. */
export const OVERRIDE_FLAG = '--i-know-what-im-doing'

export const log = (...args) => console.log('[seed]', ...args)
export const error = (...args) => console.error('[seed]', ...args)

export const isProduction = () => process.env.NODE_ENV === 'production'

/**
 * A human-readable name for the target database with any credentials stripped,
 * so the refusal message can say what it was about to destroy without leaking
 * the password out of MONGO_URI into CI logs.
 */

/**
 * Refuses destructive work against a production database unless the operator
 * typed OVERRIDE_FLAG exactly. Exits non-zero rather than throwing so the
 * message is the last thing on screen and no stack trace buries it.
 */
export function assertDestructiveAllowed(flags, { command, destroys }) {
  const target = describeTarget()

  if (!isProduction()) {
    log(`${command}: about to modify ${target}`)
    return
  }

  if (flags.includes(OVERRIDE_FLAG)) {
    error('!'.repeat(70))
    error(`NODE_ENV=production and ${OVERRIDE_FLAG} was passed.`)
    error(`Destroying demo-owned collections in ${target}.`)
    error('!'.repeat(70))
    return
  }

  error('')
  error(`REFUSING to run "${command}" — NODE_ENV is "production".`)
  error(`Target: ${target}`)
  error('')
  error('This command deletes every document in:')
  error(`  ${destroys.join(', ')}`)
  error('')
  error('Nothing was deleted and no connection was opened.')
  error('If you genuinely want to destroy that data, re-run with the exact flag:')
  error(`  npm run seed:demo -- ${OVERRIDE_FLAG}`)
  error('')
  error('To publish catalogue content to production instead — courses, programs,')
  error('workshops, posts, channels, practice, badges — use the safe, idempotent:')
  error('  npm run seed')
  error('')
  process.exit(1)
}

/**
 * The shared password for the demo accounts (task 2). Required only by paths
 * that actually create users; content publishing never touches accounts and so
 * must not demand an unrelated secret in production. Checked before connectDb()
 * so a misconfigured run never gets as far as writing.
 */
export function requireSeedPassword() {
  const seedPassword = env.seedPassword
  if (!seedPassword || seedPassword.length < 8) {
    error('SEED_PASSWORD is not set (or is shorter than 8 characters).')
    error('The demo accounts need a password and this seeder will not invent one.')
    error('Put a long random value in server/.env, e.g.')
    error('  SEED_PASSWORD="$(openssl rand -base64 24)"')
    error('then re-run `npm run seed:demo`.')
    process.exit(1)
  }
  return seedPassword
}
