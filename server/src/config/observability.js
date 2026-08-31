import fs from 'node:fs'
import path from 'node:path'
import { env } from './env.js'

/**
 * Error tracking and logging.
 *
 * Before this, server errors went to `morgan('dev')` on stdout — which on a VPS
 * means they vanish — and client errors went to a browser console nobody is
 * watching. Once real customers are paying, "a user says checkout didn't work"
 * has to be answerable from evidence rather than guesswork.
 *
 * Sentry is optional: with no `SENTRY_DSN` this module no-ops, exactly like the
 * mail layer. Nothing here may ever throw into a request.
 */

let sentry = null

/* ------------------------------- scrubbing -------------------------------- */

/**
 * Sentry is a third party and captured payloads persist there, so secrets and
 * buyer contact details are removed **before** anything leaves this process —
 * not configured away in a dashboard, where the setting is one click from being
 * turned off by someone who does not know why it is there.
 */
const SECRET_KEYS = [
  'jwt_secret',
  'jwtsecret',
  'bunny_security_key',
  'bunnysecuritykey',
  'razorpay_key_secret',
  'razorpay_webhook_secret',
  'keysecret',
  'webhooksecret',
  'resend_api_key',
  'resendapikey',
  'seed_password',
  'seedpassword',
  'password',
  'passwordhash',
  'token',
  'authorization',
  'cookie',
  'gs_token',
  'secret',
  'apikey',
  'api_key',
  'signature',
]

/** Buyer contact details. Personal data, and never needed to debug a 500. */
const PII_KEYS = ['email', 'phone', 'contact', 'utr', 'vpa', 'buyer', 'address']

const REDACTED = '[redacted]'

export function scrub(value, depth = 0) {
  if (depth > 6 || value == null) return value
  if (Array.isArray(value)) return value.map((v) => scrub(v, depth + 1))
  if (typeof value !== 'object') return value

  const out = {}
  for (const [key, val] of Object.entries(value)) {
    const lower = key.toLowerCase()
    if (SECRET_KEYS.some((k) => lower.includes(k)) || PII_KEYS.some((k) => lower === k)) {
      out[key] = REDACTED
    } else {
      out[key] = scrub(val, depth + 1)
    }
  }
  return out
}

/** Strips a query string, which is where tokens end up in a URL. */
const scrubUrl = (url) => String(url || '').split('?')[0]

/* --------------------------------- Sentry --------------------------------- */

export async function initObservability() {
  if (!env.sentryDsn) {
    console.warn('[observability] SENTRY_DSN not set — errors are logged locally only')
    return null
  }
  try {
    sentry = await import('@sentry/node')
    sentry.init({
      dsn: env.sentryDsn,
      environment: env.isProd ? 'production' : 'development',
      release: env.release || undefined,
      // Errors, not performance. Tracing on a single-instance VPS buys little
      // and multiplies the event volume.
      tracesSampleRate: 0,
      sendDefaultPii: false,
      beforeSend(event) {
        // Belt and braces on top of the scrubbing at the call site: Sentry
        // attaches request context on its own.
        if (event.request) {
          delete event.request.cookies
          if (event.request.headers) {
            for (const h of Object.keys(event.request.headers)) {
              if (['cookie', 'authorization', 'x-razorpay-signature'].includes(h.toLowerCase())) {
                event.request.headers[h] = REDACTED
              }
            }
          }
          if (event.request.data) event.request.data = scrub(event.request.data)
          if (event.request.url) event.request.url = scrubUrl(event.request.url)
        }
        event.user = undefined
        return event
      },
    })
    console.log('[observability] Sentry initialised')
    return sentry
  } catch (err) {
    // A broken error tracker must never stop the server booting.
    console.error('[observability] Sentry failed to initialise:', err.message)
    return null
  }
}

/**
 * Reports a server error. **5xx only** — a 401 on a mistyped password or a 404
 * on a stale link is normal traffic, and reporting those buries the one event
 * that matters in ten thousand that do not.
 */
export function captureServerError(err, req, status) {
  if (status < 500) return
  if (!sentry) return
  try {
    sentry.withScope((scope) => {
      scope.setLevel('error')
      scope.setTag('method', req?.method)
      scope.setTag('route', scrubUrl(req?.originalUrl))
      scope.setContext('request', {
        method: req?.method,
        url: scrubUrl(req?.originalUrl),
        body: scrub(req?.body),
        params: scrub(req?.params),
      })
      // The user id is not personal data on its own and is what makes a report
      // actionable; the email and phone are stripped above.
      if (req?.user?._id) scope.setTag('userId', String(req.user._id))
      sentry.captureException(err)
    })
  } catch (captureErr) {
    console.error('[observability] failed to report an error:', captureErr.message)
  }
}

/** Deliberate, non-exception events — a failing webhook, for instance. */
export function captureMessage(message, context = {}) {
  console.error(`[alert] ${message}`, context)
  if (!sentry) return
  try {
    sentry.withScope((scope) => {
      scope.setLevel('error')
      scope.setContext('detail', scrub(context))
      sentry.captureMessage(message)
    })
  } catch {
    // Already logged above.
  }
}

/* -------------------------------- logging --------------------------------- */

/**
 * `morgan('dev')` is a development formatter: colourised, no timestamps, not
 * machine-parseable, and gone when the process restarts. In production the
 * combined format goes to a file that survives a restart, as well as to stdout
 * where the supervisor picks it up.
 *
 * Rotation is left to logrotate — see docs/observability.md. A log that grows
 * without bound is its own outage.
 */
export function accessLogStream() {
  if (!env.isProd) return null
  try {
    const dir = path.resolve(process.cwd(), '../logs')
    fs.mkdirSync(dir, { recursive: true })
    return fs.createWriteStream(path.join(dir, 'access.log'), { flags: 'a' })
  } catch (err) {
    console.error('[observability] could not open the access log, using stdout only:', err.message)
    return null
  }
}
