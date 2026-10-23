import { createRemoteJWKSet, jwtVerify } from 'jose'
import { env } from '../config/env.js'
import { HttpError } from './error.js'
import { authSessionExists, findUserById } from '../db/repos/users.js'
import { supabaseForRequest } from '../services/supabaseAdmin.js'

/**
 * Sessions are Supabase Auth sessions, carried in two httpOnly cookies.
 *
 * The browser never holds a token it can read: Express signs the user in with
 * Supabase and stores the access token (short-lived, ~1h) and the refresh token
 * (long-lived, single-use) as cookies, so XSS cannot exfiltrate a session and
 * the single-origin cookie model from task 14 is unchanged.
 */
export const ACCESS_COOKIE = 'gs_at'
export const REFRESH_COOKIE = 'gs_rt'
const REFRESH_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

const cookieOptions = () => ({ httpOnly: true, sameSite: 'lax', secure: env.isProd, path: '/' })

/** Stores a Supabase session ({ access_token, refresh_token, expires_in }). */
export function setSessionCookies(res, session) {
  res.cookie(ACCESS_COOKIE, session.access_token, {
    ...cookieOptions(),
    maxAge: (session.expires_in || 3600) * 1000,
  })
  res.cookie(REFRESH_COOKIE, session.refresh_token, {
    ...cookieOptions(),
    maxAge: REFRESH_MAX_AGE_MS,
  })
}

export function clearSessionCookies(res) {
  res.clearCookie(ACCESS_COOKIE, cookieOptions())
  res.clearCookie(REFRESH_COOKIE, cookieOptions())
}

/**
 * Asymmetric verification against the project's published keys. No shared
 * secret lives in this process, and jose caches the key set and refetches it
 * on an unknown `kid`, so a Supabase key rotation needs no deploy.
 */
let jwks = null
const keySet = () => {
  if (!jwks) jwks = createRemoteJWKSet(new URL(`${env.supabase.url}/auth/v1/.well-known/jwks.json`))
  return jwks
}

export async function verifyAccessToken(token) {
  const { payload } = await jwtVerify(token, keySet(), {
    issuer: `${env.supabase.url}/auth/v1`,
    audience: 'authenticated',
  })
  return payload
}

/** When this session authenticated, in seconds. Falls back to `iat`. */
export function sessionStartedAt(payload) {
  const stamps = (payload.amr || []).map((a) => Number(a.timestamp)).filter(Number.isFinite)
  return stamps.length ? Math.max(...stamps) : payload.iat
}

/** Trades a refresh token for a new session, or null if it is spent or revoked. */
async function refresh(refreshToken) {
  const { data, error } = await supabaseForRequest().auth.refreshSession({
    refresh_token: refreshToken,
  })
  return error || !data?.session ? null : data.session
}

/**
 * Populates req.user when a valid session is present; never rejects.
 *
 * An expired access token with a live refresh cookie is renewed in place and the
 * new cookies are set on this response, so a learner mid-lesson is never bounced
 * to the login page by the one-hour token lifetime.
 */
export async function attachUser(req, res, next) {
  const access = req.cookies?.[ACCESS_COOKIE]
  const refreshToken = req.cookies?.[REFRESH_COOKIE]
  if (!access && !refreshToken) return next()

  let payload = null
  let token = access
  try {
    if (access) payload = await verifyAccessToken(access)
  } catch {
    // expired or tampered — fall through to the refresh token
  }

  if (!payload && refreshToken) {
    const session = await refresh(refreshToken).catch(() => null)
    if (session) {
      setSessionCookies(res, session)
      token = session.access_token
      payload = await verifyAccessToken(session.access_token).catch(() => null)
    } else {
      clearSessionCookies(res)
    }
  }
  if (!payload?.sub) return next()

  try {
    const user = await findUserById(payload.sub)

    // Signing out everywhere is a cutoff: a session that signed in before the
    // password last changed is refused. Measured from the sign-in itself
    // (`amr[].timestamp`), not `iat` — a refresh mints a new access token with a
    // fresh `iat` but keeps the original sign-in time, so an attacker's stolen
    // session cannot outlive a reset just by refreshing.
    //
    // Supabase stamps whole seconds, so a session stamped S signed in somewhere
    // in [S, S+1). If that second ended by the change, it is refused. Stamped
    // in the change's own second, it may be the old session or the one
    // the reset just issued, and the time cannot tell them apart. Supabase ended
    // every session when the password changed, so ask it whether this one
    // survived.
    const changedAtMs = user?.passwordChangedAt ? new Date(user.passwordChangedAt).getTime() : 0
    const signedInAt = sessionStartedAt(payload)
    if (changedAtMs && signedInAt) {
      const signedInMs = signedInAt * 1000
      if (signedInMs + 1000 <= changedAtMs) return next()
      if (signedInMs <= changedAtMs && !(await authSessionExists(payload.session_id))) {
        return next()
      }
    }

    // A suspension bites on the next request, not at the next sign-in.
    if (!user || user.suspendedAt) return next()

    // `req` is this request's own object and nothing else writes `req.user`.
    // eslint-disable-next-line require-atomic-updates
    req.user = user
    // Kept for logout, which revokes this session at Supabase.
    // eslint-disable-next-line require-atomic-updates
    req.accessToken = token
  } catch (err) {
    return next(err)
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
