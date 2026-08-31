import { describe, expect, it } from 'vitest'
import { Enrollment, Lead, User, Workshop, WorkshopRegistration } from '../src/models/index.js'
import { agent, PASSWORD, paidCourse, signUp, signUpAdmin } from './helpers/factories.js'

/**
 * The three screens that closed real data leaks (CRM-1, CRM-3, IAM-1).
 *
 * Leads and workshop registrations were both write-only: the public site
 * created rows nothing could read, so enquiries and sign-ups were invisible to
 * the business. Users had no management surface at all.
 *
 * The load-bearing assertions here are the guards, not the happy paths: an
 * operator must not be able to lock everyone out of the admin panel, and a
 * suspension has to bite on the next request rather than the next sign-in.
 */

async function adminAgent() {
  const { cookie, user } = await signUpAdmin()
  const as = (method, url) => agent()[method](url).set('Cookie', cookie)
  return { as, cookie, user }
}

const submitLead = (over = {}) =>
  agent()
    .post('/api/leads')
    .send({ name: 'Anjali R', email: 'anjali@example.in', phone: '9876543210', ...over })

describe('leads inbox', () => {
  it('shows a lead the public popup created', async () => {
    await submitLead().expect(201)
    const { as } = await adminAgent()

    const res = await as('get', '/api/admin/leads').expect(200)
    expect(res.body.total).toBe(1)
    expect(res.body.items[0]).toMatchObject({ email: 'anjali@example.in', status: 'New' })
    expect(res.body.counts.New).toBe(1)
  })

  it('moves a lead through the pipeline and stamps the conversion once', async () => {
    await submitLead().expect(201)
    const { as } = await adminAgent()
    const { _id } = (await as('get', '/api/admin/leads')).body.items[0]

    await as('put', `/api/admin/leads/${_id}`).send({ status: 'Converted' }).expect(200)
    const first = await Lead.findById(_id)
    expect(first.convertedAt).toBeTruthy()

    // Re-saving must not push the conversion date forward.
    await as('put', `/api/admin/leads/${_id}`).send({ status: 'Converted' }).expect(200)
    expect((await Lead.findById(_id)).convertedAt.getTime()).toBe(first.convertedAt.getTime())
  })

  it('rejects an unknown status and an owner who does not exist', async () => {
    await submitLead().expect(201)
    const { as } = await adminAgent()
    const { _id } = (await as('get', '/api/admin/leads')).body.items[0]

    await as('put', `/api/admin/leads/${_id}`).send({ status: 'Maybe' }).expect(400)
    await as('put', `/api/admin/leads/${_id}`)
      .send({ owner: '64b7f9c2e1a2b3c4d5e6f7a8' })
      .expect(400)
  })

  it('records who wrote each note', async () => {
    await submitLead().expect(201)
    const { as, user } = await adminAgent()
    const { _id } = (await as('get', '/api/admin/leads')).body.items[0]

    const res = await as('post', `/api/admin/leads/${_id}/notes`)
      .send({ body: 'Called, asked to try again Friday' })
      .expect(200)

    expect(res.body.notes).toHaveLength(1)
    expect(res.body.notes[0].authorName).toBe(user.name)
    await as('post', `/api/admin/leads/${_id}/notes`).send({ body: '   ' }).expect(400)
  })

  it('is closed without an admin session', async () => {
    await agent().get('/api/admin/leads').expect(401)
  })
})

describe('workshop registrations', () => {
  const makeWorkshop = () =>
    Workshop.create({ title: 'SEO Live', slug: 'seo-live', capacity: 2, registeredCount: 1 })

  it('lists registrants, flattening accounts and guests alike', async () => {
    const workshop = await makeWorkshop()
    const { user } = await signUp({ name: 'Priya S' })
    await WorkshopRegistration.create({ workshopId: workshop._id, userId: user._id })
    await WorkshopRegistration.create({
      workshopId: workshop._id,
      guest: { name: 'Walk-in', email: 'walkin@example.in', phone: '900000000' },
    })

    const { as } = await adminAgent()
    const res = await as(
      'get',
      `/api/admin/workshops/registrations?workshopId=${workshop._id}`,
    ).expect(200)

    expect(res.body.items).toHaveLength(2)
    expect(res.body.items.map((r) => r.kind).sort()).toEqual(['account', 'guest'])
    expect(res.body.items.find((r) => r.kind === 'account').name).toBe('Priya S')
  })

  it('marks attendance', async () => {
    const workshop = await makeWorkshop()
    const reg = await WorkshopRegistration.create({
      workshopId: workshop._id,
      guest: { email: 'a@example.in' },
    })
    const { as } = await adminAgent()

    await as('put', `/api/admin/workshops/registrations/${reg._id}`)
      .send({ attended: true })
      .expect(200)
    expect((await WorkshopRegistration.findById(reg._id)).attended).toBe(true)
  })

  it('frees the seat when a registration is removed', async () => {
    const workshop = await makeWorkshop()
    const reg = await WorkshopRegistration.create({
      workshopId: workshop._id,
      guest: { email: 'a@example.in' },
    })
    const { as } = await adminAgent()

    await as('delete', `/api/admin/workshops/registrations/${reg._id}`).expect(200)
    expect((await Workshop.findById(workshop._id)).registeredCount).toBe(0)
  })

  it('never drives the seat count below zero', async () => {
    const workshop = await Workshop.create({ title: 'W', slug: 'w', registeredCount: 0 })
    const reg = await WorkshopRegistration.create({
      workshopId: workshop._id,
      guest: { email: 'a@example.in' },
    })
    const { as } = await adminAgent()

    await as('delete', `/api/admin/workshops/registrations/${reg._id}`).expect(200)
    expect((await Workshop.findById(workshop._id)).registeredCount).toBe(0)
  })

  it('summarises registered, attended and seats left per workshop', async () => {
    const workshop = await makeWorkshop()
    await WorkshopRegistration.create({
      workshopId: workshop._id,
      guest: { email: 'a@example.in' },
      attended: true,
    })
    const { as } = await adminAgent()

    const res = await as('get', '/api/admin/workshops/summary').expect(200)
    const row = res.body.items.find((w) => w.slug === 'seo-live')
    expect(row).toMatchObject({ registered: 1, attended: 1, seatsLeft: 1 })
  })
})

describe('user management', () => {
  it('lists accounts and counts the active admins', async () => {
    await signUp({ name: 'Priya S' })
    const { as } = await adminAgent()

    const res = await as('get', '/api/admin/users').expect(200)
    expect(res.body.total).toBe(2)
    expect(res.body.activeAdmins).toBe(1)
  })

  it('refuses to demote or suspend the only active admin', async () => {
    const { as, user } = await adminAgent()

    await as('put', `/api/admin/users/${user._id}`).send({ role: 'student' }).expect(403)
    await as('post', `/api/admin/users/${user._id}/suspend`).expect(403)
    expect((await User.findById(user._id)).role).toBe('admin')
  })

  it('refuses to strand the system with no admin even via a second account', async () => {
    const { as, user: me } = await adminAgent()
    const other = await User.create({
      name: 'Second Admin',
      email: 'second@example.in',
      passwordHash: 'x',
      role: 'admin',
    })
    // Suspending the other admin is fine while `me` is still active…
    await as('post', `/api/admin/users/${other._id}/suspend`).expect(200)
    // …but now `me` is the last one standing and cannot be demoted.
    await as('put', `/api/admin/users/${me._id}`).send({ role: 'student' }).expect(403)
  })

  it('rejects an email already taken by another account', async () => {
    const { user: existing } = await signUp({ email: 'taken@example.in' })
    const { as } = await adminAgent()

    await as('put', `/api/admin/users/${existing._id}`)
      .send({ email: 'admin@example.in' })
      .expect(409)
  })

  it('will not delete an account with enrolments unless forced', async () => {
    const course = await paidCourse()
    const { user } = await signUp({ name: 'Priya S' })
    await Enrollment.create({ userId: user._id, courseId: course._id })
    const { as } = await adminAgent()

    await as('delete', `/api/admin/users/${user._id}`).expect(409)
    expect(await User.findById(user._id)).not.toBeNull()

    await as('delete', `/api/admin/users/${user._id}?force=true`).expect(200)
    expect(await User.findById(user._id)).toBeNull()
  })
})

describe('suspension', () => {
  it('refuses a suspended account at login', async () => {
    const { as } = await adminAgent()
    const { email, user } = await signUp({ name: 'Priya S' })

    await as('post', `/api/admin/users/${user._id}/suspend`)
      .send({ reason: 'Chargeback' })
      .expect(200)
    await agent().post('/api/auth/login').send({ email, password: PASSWORD }).expect(403)
  })

  it('invalidates the session already in flight, not just the next login', async () => {
    const { as } = await adminAgent()
    const { cookie, user } = await signUp({ name: 'Priya S' })

    const before = await agent().get('/api/auth/me').set('Cookie', cookie).expect(200)
    expect(before.body.user).not.toBeNull()

    await as('post', `/api/admin/users/${user._id}/suspend`).expect(200)

    // The cookie lasts seven days, so the suspension has to take effect on the
    // very next request. `/auth/me` is deliberately open — it answers with a
    // null user rather than 401 — so assert both it and a guarded route.
    const after = await agent().get('/api/auth/me').set('Cookie', cookie).expect(200)
    expect(after.body.user).toBeNull()
    await agent().get('/api/me/dashboard').set('Cookie', cookie).expect(401)
  })

  it('restores access on reactivation', async () => {
    const { as } = await adminAgent()
    const { cookie, user } = await signUp({ name: 'Priya S' })

    await as('post', `/api/admin/users/${user._id}/suspend`).expect(200)
    await as('post', `/api/admin/users/${user._id}/reactivate`).expect(200)

    const res = await agent().get('/api/auth/me').set('Cookie', cookie).expect(200)
    expect(res.body.user).not.toBeNull()
    await agent().get('/api/me/dashboard').set('Cookie', cookie).expect(200)
  })
})
