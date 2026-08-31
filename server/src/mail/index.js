import { Resend } from 'resend'
import { renderTemplate, TEMPLATE_NAMES } from './templates.js'
import { cfg } from '../services/runtimeConfig.js'

/**
 * The only place the Resend SDK is imported.
 *
 * Two rules hold everywhere this is called from:
 *
 *  1. **Unconfigured is not broken.** With no `RESEND_API_KEY` — every local
 *     checkout, every seeder run, every test — `send` logs the mail it would
 *     have sent and resolves. It never throws, so no flow has to know whether
 *     email happens to be wired up.
 *
 *  2. **A failed send never fails the request.** Money moving and access being
 *     granted are the transaction; the email is a notification about it. If
 *     Resend is down, the buyer must still get their course. Callers get an
 *     `{ ok, skipped, error }` result rather than an exception.
 */

let client = null
const resend = () => {
  if (!client) client = new Resend(cfg.resendApiKey)
  return client
}

const isConfigured = () => Boolean(cfg.resendApiKey && cfg.mailFrom)

/**
 * @param {string} template one of TEMPLATE_NAMES
 * @param {string} to       recipient address
 * @param {object} data     template data
 */
export async function send(template, to, data = {}) {
  if (!TEMPLATE_NAMES.includes(template)) {
    // A typo'd template name is a programming error, but it must not take down
    // a paid checkout — surface it loudly and carry on.
    console.error(`[mail] unknown template "${template}" — nothing sent`)
    return { ok: false, skipped: true, error: 'unknown-template' }
  }
  if (!to) {
    console.warn(`[mail] no recipient for "${template}" — nothing sent`)
    return { ok: false, skipped: true, error: 'no-recipient' }
  }

  let rendered
  try {
    rendered = renderTemplate(template, data)
  } catch (err) {
    console.error(`[mail] failed to render "${template}":`, err.message)
    return { ok: false, skipped: true, error: 'render-failed' }
  }

  if (!isConfigured()) {
    console.warn(
      `[mail] RESEND_API_KEY/MAIL_FROM not set — skipping "${template}" to ${to}` +
        `\n[mail] subject: ${rendered.subject}` +
        `\n[mail] body:\n${rendered.text}`,
    )
    return { ok: true, skipped: true }
  }

  try {
    const { data: result, error } = await resend().emails.send({
      from: cfg.mailFrom,
      to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      replyTo: cfg.business.supportEmail || undefined,
    })
    if (error) {
      console.error(`[mail] Resend rejected "${template}" to ${to}:`, error.message || error)
      return { ok: false, skipped: false, error: error.message || 'send-failed' }
    }
    return { ok: true, skipped: false, id: result?.id }
  } catch (err) {
    // Network failure, timeout, bad key. Logged, swallowed, never rethrown.
    console.error(`[mail] send failed for "${template}" to ${to}:`, err.message)
    return { ok: false, skipped: false, error: err.message }
  }
}

export { TEMPLATE_NAMES, renderTemplate }
