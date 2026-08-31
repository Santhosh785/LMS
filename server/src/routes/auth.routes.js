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
import { signToken, setAuthCookie, clearAuthCookie, requireAuth } from '../middleware/auth.js'
import User from '../models/User.js'
import { findUserByToken, sendPasswordEmail, setPassword } from '../services/passwordReset.js'

const router = Router()

const publicUser = (u) => ({
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
    if (await User.exists({ email })) {
      throw new HttpError(409, 'An account with that email already exists')
    }
    const user = await User.create({
      name,
      email,
      passwordHash: await User.hashPassword(password),
      phone,
      preferredLanguage,
      role: 'student',
    })
    setAuthCookie(res, signToken(user))
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
    const user = await User.findOne({ email: req.body.email }).select('+passwordHash')
    if (!user || !(await user.checkPassword(req.body.password))) {
      throw new HttpError(401, 'Email or password is incorrect')
    }
    // Checked after the password, so a wrong password on a suspended account
    // still answers "incorrect" rather than confirming the address exists.
    if (user.suspendedAt) {
      throw new HttpError(403, 'This account has been suspended. Contact support.')
    }
    setAuthCookie(res, signToken(user))
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
 * Timing is the other half of that promise, and the reason the mail send is not
 * awaited: issuing a token and calling Resend takes hundreds of milliseconds
 * that only ever happen for real accounts, which is a measurable tell even when
 * the bodies match. Fire-and-forget makes both branches return at the same
 * speed. `sendPasswordEmail` swallows its own errors (see mail/index.js), so
 * nothing here can reject unobserved.
 */
router.post(
  '/forgot-password',
  passwordResetIpLimiter,
  passwordResetEmailLimiter,
  body('email').isEmail().withMessage('Enter a valid email').normalizeEmail(),
  validate,
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ email: req.body.email })
    if (user) void sendPasswordEmail(user, { isNewAccount: false })

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
    // chose the password. The fresh cookie also replaces any session that the
    // new `passwordChangedAt` cutoff just invalidated, including this one.
    const fresh = await User.findById(user._id)
    setAuthCookie(res, signToken(fresh))
    res.json({ ok: true, user: publicUser(fresh) })
  }),
)

router.post('/logout', (_req, res) => {
  clearAuthCookie(res)
  res.json({ ok: true })
})

// Deliberately not guarded: the client calls this on every page load to decide
// whether anyone is signed in, so "nobody" is a normal answer, not an error.
router.get('/me', (req, res) => {
  res.json({ user: req.user ? publicUser(req.user) : null })
})

router.patch(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const allowed = [
      'name',
      'phone',
      'education',
      'currentProfile',
      'preferredLanguage',
      'weeklyGoalHours',
    ]
    const patch = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)))
    const user = await User.findByIdAndUpdate(req.user._id, patch, { new: true })
    res.json({ user: publicUser(user) })
  }),
)

export default router
