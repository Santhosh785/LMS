import { describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '../src/db/index.js'
import { users } from '../src/db/schema/index.js'
import { issuePasswordToken } from '../src/services/passwordReset.js'
import { agent, cookiesFrom, PASSWORD, signUp } from './helpers/factories.js'

/**
 * Sessions are Supabase Auth sessions held in httpOnly cookies. These pin the
 * properties the old hand-rolled JWT had, now that Supabase issues the tokens:
 * a session survives its short access token, a password reset ends every other
 * session — including one that refreshes — and a suspension bites immediately.
 */

const me = (cookie) => agent().get('/api/auth/me').set('Cookie', cookie)

/** Only the refresh cookie: what a browser holds once the 1h access token lapses. */
const refreshOnly = (cookie) =>
  cookie
    .split('; ')
    .filter((c) => c.startsWith('gs_rt='))
    .join('; ')

describe('auth sessions (Supabase)', () => {
  it('register signs the user in with httpOnly cookies and /me resolves them', async () => {
    const res = await agent()
      .post('/api/auth/register')
      .send({ name: 'Asha Rao', email: 'asha@example.in', password: PASSWORD })
      .expect(201)

    const setCookie = res.headers['set-cookie'].join('\n')
    expect(setCookie).toMatch(/gs_at=.*HttpOnly/)
    expect(setCookie).toMatch(/gs_rt=.*HttpOnly/)
    expect(res.body.user).toMatchObject({ email: 'asha@example.in', role: 'student' })

    const who = await me(cookiesFrom(res)).expect(200)
    expect(who.body.user).toMatchObject({ email: 'asha@example.in', avatarInitials: 'AR' })
  })

  it('rejects a duplicate email and a wrong password without saying which', async () => {
    await signUp({ email: 'dup@example.in' })
    await agent()
      .post('/api/auth/register')
      .send({ name: 'X', email: 'dup@example.in', password: PASSWORD })
      .expect(409)

    const wrong = await agent()
      .post('/api/auth/login')
      .send({ email: 'dup@example.in', password: 'not-the-password' })
      .expect(401)
    const unknown = await agent()
      .post('/api/auth/login')
      .send({ email: 'nobody@example.in', password: 'not-the-password' })
      .expect(401)
    expect(wrong.body.message).toBe(unknown.body.message)
  })

  it('an expired access token is renewed from the refresh cookie', async () => {
    const { cookie } = await signUp({ email: 'renew@example.in' })
    const res = await me(refreshOnly(cookie)).expect(200)
    expect(res.body.user?.email).toBe('renew@example.in')
    // The renewal is persisted for the next request.
    expect(res.headers['set-cookie'].join('\n')).toMatch(/gs_at=/)
  })

  it('logout clears the session', async () => {
    const { cookie } = await signUp({ email: 'bye@example.in' })
    const out = await agent().post('/api/auth/logout').set('Cookie', cookie).expect(200)
    expect(out.headers['set-cookie'].join('\n')).toMatch(/gs_at=;/)
  })

  it('a password reset ends other sessions, even ones that refresh', async () => {
    const { cookie, user } = await signUp({ email: 'reset@example.in' })
    expect((await me(cookie)).body.user).not.toBeNull()

    const { token } = await issuePasswordToken(user.id)
    const reset = await agent()
      .post('/api/auth/reset-password')
      .send({ token, password: 'a-brand-new-password' })
      .expect(200)

    // The old session is refused — and refreshing it does not resurrect it,
    // because the cutoff is measured from when that session signed in.
    expect((await me(cookie)).body.user).toBeNull()
    expect((await me(refreshOnly(cookie))).body.user).toBeNull()

    // The session the reset itself issued works, and so does the new password.
    expect((await me(cookiesFrom(reset))).body.user?.email).toBe('reset@example.in')
    await agent()
      .post('/api/auth/login')
      .send({ email: 'reset@example.in', password: 'a-brand-new-password' })
      .expect(200)

    // The token is single-use.
    await agent()
      .post('/api/auth/reset-password')
      .send({ token, password: 'yet-another-password' })
      .expect(400)
  })

  it('a suspension takes effect on the next request', async () => {
    const { cookie, user } = await signUp({ email: 'sus@example.in' })
    await db.update(users).set({ suspendedAt: new Date() }).where(eq(users.id, user.id))
    expect((await me(cookie)).body.user).toBeNull()
    await agent()
      .post('/api/auth/login')
      .send({ email: 'sus@example.in', password: PASSWORD })
      .expect(403)
  })

  it('PATCH /me cannot change the role', async () => {
    const { cookie } = await signUp({ email: 'climb@example.in' })
    const res = await agent()
      .patch('/api/auth/me')
      .set('Cookie', cookie)
      .send({ name: 'New Name', role: 'admin' })
      .expect(200)
    expect(res.body.user).toMatchObject({ name: 'New Name', role: 'student' })
  })
})
