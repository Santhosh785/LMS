import { env } from '../config/env.js'

/**
 * A human description of the database a command is about to touch, with the
 * credentials stripped.
 *
 * The Supabase connection string carries the database password, and the places
 * this gets printed — boot logs, seeder confirmations, CI output, screenshots —
 * are exactly the places a password should never appear.
 */
export function describeTarget(uri = env.databaseUrl) {
  if (!uri) return 'an unknown database (DATABASE_URL is not set)'
  const masked = uri.replace(/\/\/[^/@]*@/, '//<credentials>@')
  const match = /^[^:]+:\/\/([^/?]+)(?:\/([^/?]*))?/.exec(masked)
  if (!match) return 'an unrecognised DATABASE_URL'
  const host = match[1].replace(/^<credentials>@/, '')
  const db = match[2] || '(default database)'
  return `database "${db}" on ${host}`
}
