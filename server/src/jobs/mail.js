import { findUserByEmail } from '../db/repos/users.js'
import { send } from '../mail/index.js'
import { sendPasswordEmail } from '../services/passwordReset.js'
import { defineJob } from '../services/queue.js'
import { dispatch } from './dispatch.js'

/**
 * Transactional mail on the queue. See docs/jobs.md.
 *
 * `send` never throws — it reports `{ ok, skipped, error }` so the callers that
 * stay synchronous (the admin test-email and resend-link buttons) can show the
 * outcome. A job has to throw to be retried, so the result is translated here:
 *
 *  - a deliberate skip completes: no API key or sender configured
 *    (`ok: true, skipped: true`), or an unknown template, a missing recipient or
 *    a template that failed to render (`ok: false, skipped: true`). Retrying
 *    cannot make any of those succeed.
 *  - a provider rejection or network failure (`ok: false, skipped: false`)
 *    throws with the provider's message, and the queue retries it.
 */

export class MailDeliveryError extends Error {
  constructor(template, reason) {
    super(`Mail "${template}" was not delivered: ${reason || 'send-failed'}`)
    this.name = 'MailDeliveryError'
    this.template = template
    this.reason = reason
  }
}

/** Throws when `result` is a real delivery failure; returns it otherwise. */
export function assertDelivered(template, result) {
  if (result && result.ok === false && !result.skipped) {
    throw new MailDeliveryError(template, result.error)
  }
  return result
}

/** `send`, but a provider failure throws — for use inside job handlers. */
export async function deliverMail(template, to, data = {}) {
  return assertDelivered(template, await send(template, to, data))
}

/** Job `send-mail` — data `{ template, to, data }`. */
export async function sendMailJob({ template, to, data } = {}) {
  return deliverMail(template, to, data)
}

defineJob('send-mail', { handler: sendMailJob })

/**
 * Queues a mail from a request. Resolves once it is safely queued (or, inline,
 * immediately); never rejects and never fails the request.
 */
export const queueMail = (template, to, data = {}) => dispatch('send-mail', { template, to, data })

/**
 * Job `send-password-reset` — data `{ email }`.
 *
 * The forgot-password endpoint enqueues this for every well-formed request,
 * account or not, and does nothing else: the lookup, the token and the mail all
 * happen here, off the request, so a real account and an unknown address cost
 * the endpoint exactly the same work. An unknown address completes quietly.
 *
 * A retry issues a fresh token, which kills the one in the attempt that failed —
 * that mail was never delivered, so no working link is lost.
 */
export async function sendPasswordResetJob({ email } = {}) {
  const user = email ? await findUserByEmail(email) : null
  if (!user) return { sent: false, reason: 'no-account' }
  const result = assertDelivered(
    'set-password',
    await sendPasswordEmail(user, { isNewAccount: false }),
  )
  return { sent: !result?.skipped }
}

defineJob('send-password-reset', { handler: sendPasswordResetJob })

export const queuePasswordReset = (email) => dispatch('send-password-reset', { email })
