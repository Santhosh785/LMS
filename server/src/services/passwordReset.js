import crypto from 'node:crypto'
import { and, eq, gt } from 'drizzle-orm'
import { env } from '../config/env.js'
import { db } from '../db/index.js'
import { users } from '../db/schema/index.js'
import { profile } from '../db/repos/users.js'
import { supabaseAdmin } from './supabaseAdmin.js'
import { send } from '../mail/index.js'

/**
 * Password reset and first-password tokens.
 *
 * One mechanism serves both: a learner who forgot their password, and a buyer
 * whose account was created for them by the UPI approval in task 12 and who has
 * never had one. Only the copy differs — building a parallel "invite" path would
 * mean two token implementations to keep secure, and the second one always rots.
 *
 * The token is 32 random bytes. Only its SHA-256 is stored, so a database dump
 * yields nothing usable: an attacker holding the hash cannot reverse it into a
 * working link. SHA-256 rather than bcrypt is correct here — the input is
 * already 256 bits of entropy, so there is no dictionary to slow down, and the
 * hash is computed on every reset request.
 *
 * These are our tokens, not Supabase recovery links: a Supabase link is spent by
 * the first verify (which the reset page's "is this link still good?" check
 * would be), and the project has one OTP expiry where this needs two. Supabase
 * still owns the credential — the new password is set through its admin API.
 */

/** Self-service reset. Short, because the person is at their keyboard now. */
export const RESET_TTL_MS = 60 * 60 * 1000 // 1 hour
/**
 * First password for an account someone else created. A buyer who paid by UPI
 * may not open their mail for a day, and an expired invite leaves them holding a
 * paid course they cannot sign in to. They can still self-serve a fresh link.
 */
export const INVITE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex')

const durationLabel = (ms) => {
  const hours = Math.round(ms / (60 * 60 * 1000))
  return hours >= 24
    ? `${Math.round(hours / 24)} day${hours >= 48 ? 's' : ''}`
    : `${hours} hour${hours > 1 ? 's' : ''}`
}

export const resetUrlFor = (token) =>
  `${env.siteUrl}/reset-password?token=${encodeURIComponent(token)}`

/**
 * Issues a fresh token, replacing any outstanding one — requesting a new link
 * must kill the old one, or a stolen earlier email stays live.
 */
export async function issuePasswordToken(userId, { ttlMs = RESET_TTL_MS } = {}) {
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + ttlMs)
  await db
    .update(users)
    .set({ passwordResetTokenHash: hashToken(token), passwordResetExpiresAt: expiresAt })
    .where(eq(users.id, userId))
  return { token, expiresAt, url: resetUrlFor(token), expiresInLabel: durationLabel(ttlMs) }
}

/** Resolves a raw token to its user, or null when unknown, expired or spent. */
export async function findUserByToken(token) {
  if (!token || typeof token !== 'string') return null
  const [row] = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.passwordResetTokenHash, hashToken(token)),
        gt(users.passwordResetExpiresAt, new Date()),
      ),
    )
  return profile(row)
}

/**
 * Sets a new password and closes everything the old one opened: the token is
 * consumed, any other outstanding token dies with it, and `passwordChangedAt`
 * moves forward. `attachUser` compares that against the time each session
 * *signed in* (not when its current access token was minted), so a session an
 * attacker already holds is refused immediately — and stays refused even after
 * it uses its refresh token, because a refresh keeps the original sign-in time.
 */
export async function setPassword(user, plainPassword) {
  const id = user.id || user._id
  const { error } = await supabaseAdmin().auth.admin.updateUserById(id, {
    password: plainPassword,
  })
  if (error) throw new Error(`Supabase password update failed: ${error.message}`)

  await db
    .update(users)
    .set({
      passwordChangedAt: new Date(),
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
    })
    .where(eq(users.id, id))
}

/**
 * Issues a token and mails it, returning `send`'s result. Called from the
 * `send-password-reset` and `fulfil-payment-side-effects` jobs (jobs/), which
 * turn a delivery failure into a retry, and awaited directly only by the admin
 * "resend link" action, which reports the outcome.
 *
 * Never awaited on the request path where timing is observable — see the note in
 * auth.routes.js about account enumeration.
 */
export async function sendPasswordEmail(user, { isNewAccount = false } = {}) {
  const { url, expiresInLabel } = await issuePasswordToken(user.id || user._id, {
    ttlMs: isNewAccount ? INVITE_TTL_MS : RESET_TTL_MS,
  })
  // With Resend unconfigured this logs the whole message, link included, so a
  // developer can complete the flow from the server log rather than concluding
  // that password reset is broken.
  return send('set-password', user.email, {
    name: user.name,
    email: user.email,
    resetUrl: url,
    expiresInLabel,
    isNewAccount,
  })
}
