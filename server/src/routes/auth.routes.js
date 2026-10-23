import { Router } from 'express'
import { body } from 'express-validator'
import { validate } from '../middleware/validate.js'
import {
  loginLimiter,
  registerLimiter,
  passwordResetIpLimiter,
  passwordResetEmailLimiter,
} from '../middleware/rateLimit.js'
import { asyncHandler, HttpError } from '../middleware/error.js'
import { clearSessionCookies, requireAuth, setSessionCookies } from '../middleware/auth.js'
import {
  createAccount,
  EmailTakenError,
  findUserByEmail,
  updateProfile,
} from '../db/repos/users.js'
import { supabaseAdmin, supabaseForRequest } from '../services/supabaseAdmin.js'
import { findUserByToken, setPassword } from '../services/passwordReset.js'
import { queuePasswordReset } from '../jobs/mail.js'

const router = Router()

/** Signs in at Supabase and returns the session, or null on bad credentials. */
async function passwordSession(email, password) {
  const { data, error } = await supabaseForRequest().auth.signInWithPassword({ email, password })
  if (error || !data?.session) {
    // 400 "Invalid login credentials" is the expected miss; anything else is
    // Supabase being unreachable or rate-limiting, which is ours to see.
    if (error && error.status !== 400) console.error('[auth] sign-in failed:', error.message)
    return null
  }
  return data.session
}

/**
 * The user as the browser may see it. Also what the React Router load context
 * carries as `user` for a server render (middleware/reactRouter.js), so the
 * document and GET /auth/me agree on the shape.
 */
export const publicUser = (u) => ({
  id: u._id,
  name: u.name,
  email: u.email,
  role: u.role,
  avatarInitials: u.avatarInitials,
  phone: u.phone,
  education: u.education,
  currentProfile: u.currentProfile,
  preferredLanguage: u.preferredLanguage,
  streakDays: u.streakDays,
  hoursThisWeek: u.hoursThisWeek,
  seeds: u.seeds,
  weeklyGoalHours: u.weeklyGoalHours,
})

router.post(
  '/register',
  registerLimiter,
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Enter a valid email').normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Use at least 8 characters'),
  validate,
  asyncHandler(async (req, res) => {
    const { name, email, password, phone, preferredLanguage } = req.body
    let user
    try {
      user = await createAccount({ name, email, password, phone, preferredLanguage })
    } catch (err) {
      if (err instanceof EmailTakenError) throw new HttpError(409, err.message)
      throw err
    }
    const session = await passwordSession(user.email, password)
    if (!session) throw new HttpError(503, 'Account created, but sign-in failed — try logging in')
    setSessionCookies(res, session)
    res.status(201).json({ user: publicUser(user) })
  }),
)

router.post(
  '/login',
  loginLimiter,
  body('email').isEmail().withMessage('Enter a valid email').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
  validate,
  asyncHandler(async (req, res) => {
    const session = await passwordSession(req.body.email, req.body.password)
    const user = session ? await findUserByEmail(req.body.email) : null
    if (!session || !user) {
      throw new HttpError(401, 'Email or password is incorrect')
    }
    // Checked after the password, so a wrong password on a suspended account
    // still answers "incorrect" rather than confirming the address exists.
    if (user.suspendedAt) {
      await supabaseAdmin()
        .auth.admin.signOut(session.access_token, 'local')
        .catch(() => {})
      throw new HttpError(403, 'This account has been suspended. Contact support.')
    }
    setSessionCookies(res, session)
    res.json({ user: publicUser(user) })
  }),
)

/* ---------------------------- password recovery --------------------------- */

/**
 * Ask for a reset link.
 *
 * **Responds identically whether or not the account exists.** Same status, same
 * body — a differing answer turns this endpoint into an account enumeration
 * oracle, letting anyone test an email list against the customer base.
 *
 * Timing is the other half of that promise. Looking the account up, issuing a
 * token and calling Resend take time that only ever happens for real accounts —
 * a measurable tell even when the bodies match. So the request does none of it:
 * every well-formed request queues the same `send-password-reset` job with the
 * address (jobs/mail.js), and the job does the lookup, the token and the mail.
 * Known and unknown addresses therefore cost this handler exactly the same
 * work: one enqueue with the queue running, and inline (tests, BOSS_ENABLED=0)
 * a job that runs in the background, unawaited. Queuing never rejects.
 */
router.post(
  '/forgot-password',
  passwordResetIpLimiter,
  passwordResetEmailLimiter,
  body('email').isEmail().withMessage('Enter a valid email').normalizeEmail(),
  validate,
  asyncHandler(async (req, res) => {
    await queuePasswordReset(req.body.email)

    res.json({ ok: true, message: 'If that email has an account, a reset link is on its way.' })
  }),
)

/**
 * Lets the reset page tell a dead link from a live one before the visitor types
 * a password. Requires the token itself, so it reveals nothing to someone who
 * does not already hold it.
 */
router.get(
  '/reset-password/:token',
  asyncHandler(async (req, res) => {
    const user = await findUserByToken(req.params.token)
    if (!user) {
      throw new HttpError(400, 'This link has expired or has already been used', {
        code: 'INVALID_TOKEN',
      })
    }
    res.json({ valid: true, email: user.email, name: user.name })
  }),
)

/** Sets the new password and consumes the token. Same rules as register. */
router.post(
  '/reset-password',
  passwordResetIpLimiter,
  body('token').notEmpty().withMessage('Reset token is missing'),
  body('password').isLength({ min: 8 }).withMessage('Use at least 8 characters'),
  validate,
  asyncHandler(async (req, res) => {
    const user = await findUserByToken(req.body.token)
    if (!user) {
      throw new HttpError(400, 'This link has expired or has already been used', {
        code: 'INVALID_TOKEN',
      })
    }

    await setPassword(user, req.body.password)

    // Sign in immediately: the person just proved control of the mailbox and
    // chose the password. The fresh session also replaces any that the new
    // `passwordChangedAt` cutoff just invalidated, including this one.
    const session = await passwordSession(user.email, req.body.password)
    if (session) setSessionCookies(res, session)
    else clearSessionCookies(res)
    res.json({ ok: true, user: publicUser(await findUserByEmail(user.email)) })
  }),
)

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    // Revoke at Supabase too, so the refresh token in the cookie being cleared
    // cannot be replayed from a copy taken earlier.
    if (req.accessToken) {
      await supabaseAdmin()
        .auth.admin.signOut(req.accessToken, 'local')
        .catch(() => {})
    }
    clearSessionCookies(res)
    res.json({ ok: true })
  }),
)

// Deliberately not guarded: the client calls this on every page load to decide
// whether anyone is signed in, so "nobody" is a normal answer, not an error.
router.get('/me', (req, res) => {
  res.json({ user: req.user ? publicUser(req.user) : null })
})

router.patch(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    // updateProfile only writes the self-editable fields; role and suspension
    // are not among them, whatever the body says.
    const user = await updateProfile(req.user.id, req.body)
    res.json({ user: publicUser(user) })
  }),
)

export default router
