import { env } from '../config/env.js'

/**
 * A human description of the database a command is about to touch, with the
 * credentials stripped.
 *
 * On Atlas the connection string carries the database password, and the places
 * this gets printed — boot logs, seeder confirmations, CI output, screenshots —
 * are exactly the places a password should never appear.
 */
export function describeTarget(uri = env.mongoUri) {
  if (!uri) return 'an unknown database (MONGO_URI is not set)'
  const masked = uri.replace(/\/\/[^/@]*@/, '//<credentials>@')
  const match = /^[^:]+:\/\/([^/?]+)(?:\/([^/?]*))?/.exec(masked)
  if (!match) return 'an unrecognised MONGO_URI'
  const host = match[1].replace(/^<credentials>@/, '')
  const db = match[2] || '(default database)'
  return `database "${db}" on ${host}`
}
