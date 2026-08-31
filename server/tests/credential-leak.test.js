import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { agent } from './helpers/factories.js'

/**
 * Regression guard on the credential leak.
 *
 * The login page shipped with the admin password printed on it
 * (`client/src/pages/public/Login.jsx`, before task 2). That is the kind of bug
 * that is obvious in hindsight, invisible in review, and catastrophic in
 * production — so it gets a test rather than a promise.
 *
 * The test scans the **built** client, not the source, because the build is what
 * actually reaches a browser: a credential in a data file, a comment or an
 * environment variable inlined by Vite would all pass a source-level grep.
 */

const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)))
const dist = path.join(root, 'client', 'dist')

/**
 * Strings that must never appear in anything served to a browser. Deliberately
 * literal — a clever regex is one refactor away from matching nothing.
 */
const FORBIDDEN = [
  'password123', // the credential that actually shipped
  'SEED_PASSWORD',
  'BUNNY_SECURITY_KEY',
  'RAZORPAY_KEY_SECRET',
  'RAZORPAY_WEBHOOK_SECRET',
  'RESEND_API_KEY',
  'JWT_SECRET',
  'rzp_live_', // a live gateway secret key prefix
  're_', // Resend key prefix — see the note on false positives below
  'mongodb+srv://',
]

/**
 * `re_` is two characters and appears inside ordinary words, so it is checked
 * only as a whole key-shaped token rather than as a substring.
 */
const asPattern = (needle) =>
  needle === 're_'
    ? /\bre_[A-Za-z0-9]{16,}\b/
    : new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))

function walk(dir) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    // Only text assets can carry a readable credential.
    else if (/\.(js|mjs|css|html|json|map|txt)$/i.test(entry.name)) out.push(full)
  }
  return out
}

describe('credential leak', () => {
  it('has no seeded credential or secret in the built client', () => {
    if (!fs.existsSync(dist)) {
      throw new Error(
        `client/dist not found. Run "npm --prefix client run build" before the test suite — ` +
          'this check is meaningless against a stale or missing build.',
      )
    }

    const offenders = []
    for (const file of walk(dist)) {
      const contents = fs.readFileSync(file, 'utf8')
      for (const needle of FORBIDDEN) {
        if (asPattern(needle).test(contents)) {
          offenders.push(`${path.relative(root, file)} contains "${needle}"`)
        }
      }
    }

    expect(offenders).toEqual([])
  })

  it('does not serve a credential from the login page', async () => {
    const res = await agent().get('/api/config')
    expect(res.text).not.toMatch(/password123/i)
    expect(res.text).not.toContain('test-bunny-security-key')
    expect(res.text).not.toContain('test-razorpay-key-secret')
    expect(res.text).not.toContain('test-razorpay-webhook-secret')
  })

  it('never returns a password hash from an auth endpoint', async () => {
    const { signUp } = await import('./helpers/factories.js')
    const { cookie } = await signUp()

    const me = await agent().get('/api/auth/me').set('Cookie', cookie)

    expect(me.status).toBe(200)
    expect(me.text).not.toContain('passwordHash')
    expect(me.text).not.toContain('$2a$')
    expect(me.text).not.toContain('passwordResetTokenHash')
  })
})
