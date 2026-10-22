import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { HttpError } from './error.js'
import User from '../models/User.js'

export const TOKEN_COOKIE = 'gs_token'

export function signToken(user) {
  return jwt.sign({ sub: String(user._id), role: user.role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  })
}

export function setAuthCookie(res, token) {
  res.cookie(TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProd,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  })
}

export function clearAuthCookie(res) {
  res.clearCookie(TOKEN_COOKIE, { httpOnly: true, sameSite: 'lax', secure: env.isProd })
}

/** Populates req.user when a valid token is present; never rejects. */
export async function attachUser(req, _res, next) {
  const token = req.cookies?.[TOKEN_COOKIE]
  if (!token) return next()
  try {
    const payload = jwt.verify(token, env.jwtSecret)
    const user = await User.findById(payload.sub).select('-passwordHash')

    // A JWT is stateless, so "log out everywhere" has to be expressed as a
    // cutoff: any token minted before the password last changed is refused.
    // Without this, resetting a password an attacker already knows leaves the
    // session they are sitting in fully alive for another seven days.
    // `iat` is in seconds; allow one second of slack so the token issued by the
    // reset itself is not caught by its own cutoff.
    const changedAt = user?.passwordChangedAt
    if (changedAt && payload.iat && payload.iat * 1000 < changedAt.getTime() - 1000) {
      return next()
    }

    // A suspension has to bite on the next request, not at the next sign-in:
    // the cookie lasts seven days, so checking only at login would leave a
    // suspended account fully active for the rest of the week.
    if (user?.suspendedAt) return next()

    // `req` is this request's own object and nothing else writes `req.user`;
    // the rule cannot see that a per-request object has no concurrent writer.
    // eslint-disable-next-line require-atomic-updates
    req.user = user
  } catch {
    // expired or tampered — treat as anonymous
  }
  next()
}

export function requireAuth(req, _res, next) {
  if (!req.user) return next(new HttpError(401, 'Sign in to continue'))
  next()
}

export function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) return next(new HttpError(401, 'Sign in to continue'))
    if (!roles.includes(req.user.role)) {
      return next(new HttpError(403, 'You do not have access to this area'))
    }
    next()
  }
}
