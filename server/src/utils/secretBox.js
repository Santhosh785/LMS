import crypto from 'node:crypto'
import { env } from '../config/env.js'

/**
 * Authenticated encryption for the credentials an admin stores in the database.
 *
 * Moving API keys out of `.env` and into a settings screen means they now live
 * in Mongo, where a backup, a log or a stray `.find()` could expose them. So
 * they are sealed with AES-256-GCM and only ever unsealed by the service that
 * needs them; the admin API returns a masked hint and never the plaintext.
 *
 * The root key still has to come from the environment — there is no way to keep
 * a secret from someone who already holds the database. `CONFIG_SECRET` is the
 * dedicated variable; it falls back to `JWT_SECRET` so existing deployments
 * keep working without a new value being set first.
 */

const PREFIX = 'v1'
const ALGO = 'aes-256-gcm'

/** scrypt is deliberate: a fast hash would make the root key easy to brute. */
let cachedKey = null
function key() {
  if (cachedKey) return cachedKey
  const root = process.env.CONFIG_SECRET || env.jwtSecret
  cachedKey = crypto.scryptSync(root, 'growth-scholar/config', 32)
  return cachedKey
}

export function seal(plain) {
  if (plain === null || plain === undefined || plain === '') return ''
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGO, key(), iv)
  const body = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [PREFIX, iv.toString('base64'), tag.toString('base64'), body.toString('base64')].join(':')
}

/**
 * Returns '' rather than throwing when the value cannot be opened — a rotated
 * root key must degrade to "this integration is unconfigured" and fall back to
 * the environment, not crash every request that touches it.
 */
export function open(sealed) {
  if (!sealed || typeof sealed !== 'string') return ''
  const [prefix, iv, tag, body] = sealed.split(':')
  if (prefix !== PREFIX || !iv || !tag || !body) return ''
  try {
    const decipher = crypto.createDecipheriv(ALGO, key(), Buffer.from(iv, 'base64'))
    decipher.setAuthTag(Buffer.from(tag, 'base64'))
    return Buffer.concat([decipher.update(Buffer.from(body, 'base64')), decipher.final()]).toString(
      'utf8',
    )
  } catch {
    return ''
  }
}

/**
 * What the admin screen shows in place of a stored secret: enough to recognise
 * which key is in there, never enough to use it.
 */
export function mask(plain) {
  if (!plain) return ''
  const s = String(plain)
  return s.length <= 4 ? '••••' : `••••${s.slice(-4)}`
}
