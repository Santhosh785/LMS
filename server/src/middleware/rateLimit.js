import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import { env } from '../config/env.js'

/**
 * Every limiter is keyed on the client IP, and a test suite is one IP making
 * hundreds of requests — the sixth `signUp()` helper call would 429 and the
 * failure would look like a bug in whatever was being tested.
 *
 * Skipping under `NODE_ENV=test` rather than raising the limits, because a
 * raised limit is a number that silently stops meaning anything. The limits
 * themselves are exercised by hand and in the pre-launch checks, not here.
 */
const skipInTests = { skip: () => env.isTest }

/**
 * Brute-force guard for the credential endpoints.
 *
 * Deliberately narrow: only POST /api/auth/login and POST /api/auth/register.
 * GET /api/auth/me runs on every page load, so limiting the whole /api/auth
 * router — let alone the whole API — would lock out normal browsing in seconds.
 *
 * Failed *and* successful attempts both count. Skipping successes would let an
 * attacker who already holds one valid account reset the counter between
 * guesses at another.
 *
 * Counting is per IP, which depends on `app.set('trust proxy', …)` matching the
 * deployment — see env.trustProxy.
 */
const authLimiter = () =>
  rateLimit({
    ...skipInTests,
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 5, // attempts per IP, per window
    standardHeaders: 'draft-7', // RateLimit / RateLimit-Policy
    legacyHeaders: false, // drop the X-RateLimit-* set
    // Same envelope the error middleware produces, so the client's apiError()
    // shows this as a normal form error, not "Request failed with status 429".
    handler: (_req, res) =>
      res.status(429).json({
        error: 'Too many attempts from this device. Please wait 15 minutes and try again.',
      }),
  })

// Separate counters: five mistyped passwords should not also block someone from
// creating the account they turned out not to have.
export const loginLimiter = authLimiter()
export const registerLimiter = authLimiter()

const tooMany = (message) => (_req, res) => res.status(429).json({ error: message })

/**
 * Password reset is a mail-bomb vector: the request needs no credentials and
 * makes us send mail to an address the requester names. Two counters, because
 * they stop different attacks.
 *
 * Per IP — one machine hammering many addresses.
 */
export const passwordResetIpLimiter = rateLimit({
  ...skipInTests,
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: tooMany('Too many reset requests from this device. Please try again in an hour.'),
})

/**
 * Per target address — a distributed set of machines burying one person's inbox.
 * Keyed on the submitted email, so it survives an attacker rotating IPs.
 *
 * The limit is deliberately reached *silently*: the handler returns the same
 * body the endpoint returns on success, because a 429 here would confirm that
 * the address is worth hammering. See the enumeration note in auth.routes.js.
 */
export const resetEmailKey = (req) =>
  String(req.body?.email || '')
    .trim()
    .toLowerCase() || ipKeyGenerator(req.ip)

export const passwordResetEmailLimiter = rateLimit({
  ...skipInTests,
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: false,
  legacyHeaders: false,
  /**
   * Keyed on the submitted address, falling back to the client IP when the
   * request carries no email at all (a malformed POST that never reaches
   * validation).
   *
   * The fallback must go through `ipKeyGenerator`, not `req.ip` directly.
   * A raw IPv6 address is per-device, and an attacker on a /64 has billions of
   * them — express-rate-limit refuses a bare `req.ip` for exactly that reason
   * and throws ERR_ERL_KEY_GEN_IPV6, which took this endpoint down at the first
   * request rather than merely weakening it.
   */
  keyGenerator: resetEmailKey,
  handler: (_req, res) =>
    res.json({
      ok: true,
      message: 'If that email has an account, a reset link is on its way.',
    }),
})

/**
 * Unauthenticated writes from the public checkout form (task 10). Looser than
 * the credential endpoints — a buyer retrying a failed submission is normal —
 * but bounded, because it creates database rows.
 */
export const checkoutLimiter = rateLimit({
  ...skipInTests,
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: tooMany('Too many attempts. Please wait a few minutes, then try again.'),
})

/** Reporting content (task 17) is trivially abusable as a harassment tool. */
export const reportLimiter = rateLimit({
  ...skipInTests,
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: tooMany('You have reported a lot of content recently. Please try again later.'),
})
