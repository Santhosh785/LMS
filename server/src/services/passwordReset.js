import crypto from 'node:crypto'
import { env } from '../config/env.js'
import { User } from '../models/index.js'
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
  await User.updateOne(
    { _id: userId },
    { $set: { passwordResetTokenHash: hashToken(token), passwordResetExpiresAt: expiresAt } },
  )
  return { token, expiresAt, url: resetUrlFor(token), expiresInLabel: durationLabel(ttlMs) }
}

/** Resolves a raw token to its user, or null when unknown, expired or spent. */
export async function findUserByToken(token) {
  if (!token || typeof token !== 'string') return null
  return User.findOne({
    passwordResetTokenHash: hashToken(token),
    passwordResetExpiresAt: { $gt: new Date() },
  })
}

/**
 * Sets a new password and closes everything the old one opened: the token is
 * consumed, any other outstanding token dies with it, and `passwordChangedAt`
 * moves forward — which `attachUser` reads to reject JWTs issued earlier, so a
 * session an attacker already holds stops working.
 */
export async function setPassword(user, plainPassword) {
  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        passwordHash: await User.hashPassword(plainPassword),
        passwordChangedAt: new Date(),
      },
      $unset: { passwordResetTokenHash: 1, passwordResetExpiresAt: 1 },
    },
  )
}

/**
 * The password column cannot be empty — `passwordHash` is required — so an
 * account created on someone's behalf gets a hash of 32 random bytes that are
 * then discarded. Nobody, including us, knows a plaintext that matches it. The
 * set-password email is the only way in.
 */
export async function unusablePasswordHash() {
  return User.hashPassword(crypto.randomBytes(32).toString('hex'))
}

/**
 * Issues a token and mails it. Used by the forgot-password endpoint and by the
 * task 12 approval flow for accounts it creates.
 *
 * Never awaited on the request path where timing is observable — see the note in
 * auth.routes.js about account enumeration.
 */
export async function sendPasswordEmail(user, { isNewAccount = false } = {}) {
  const { url, expiresInLabel } = await issuePasswordToken(user._id, {
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
