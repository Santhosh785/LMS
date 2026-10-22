import { describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '../src/db/index.js'
import { fitCallBookings, flagshipApplications } from '../src/db/schema/index.js'
import { agent, signUpAdmin } from './helpers/factories.js'

const savedApplication = async (id) =>
  (await db.select().from(flagshipApplications).where(eq(flagshipApplications.id, id)))[0]
const savedFitCall = async (id) =>
  (await db.select().from(fitCallBookings).where(eq(fitCallBookings.id, id)))[0]

/**
 * The Flagship intake: /programs/apply and /programs/fit-call.
 *
 * These two forms are the only route into a ten-seat, ₹79,999 programme. The
 * drop validates them in the browser alone, so the assertions that matter here
 * are the server-side guards — a bot or a stale tab posting straight to the API
 * must not be able to create a junk application, and a conditional answer must
 * not survive when the branch that asked it is off.
 */

async function adminAgent() {
  const { cookie } = await signUpAdmin()
  return (method, url) => agent()[method](url).set('Cookie', cookie)
}

const validApplication = (over = {}) => ({
  fullName: 'Dinesh K',
  email: 'dinesh@example.in',
  phone: '9876543210',
  city: 'Chennai',
  state: 'Tamil Nadu',
  trackPreference: 'track-b',
  batchPreference: 'batch-4',
  mentoringLanguage: 'tamil',
  currentStatus: 'Freelancer / consultant',
  weeklyHours: '10-12',
  liveAvailability: ['weekday-evening'],
  hasSetup: 'yes',
  masterclassCity: 'Chennai',
  experienceLevel: 'working-marketer',
  channels: ['seo', 'meta'],
  referralSource: 'LinkedIn',
  referralDetail: 'A post by Aravinth',
  whyFlagship: 'I want mentor review on real campaigns.',
  twelveWeekOutcome: 'Three retainer clients.',
  shipStory: 'Ran a Meta campaign, learned the offer was wrong.',
  curriculumHook: 'The SEO + AEO + GEO module.',
  paymentPlan: 'full',
  batchGotcha: 'Batch 4',
  consentWhatsapp: true,
  consentAccurate: true,
  ...over,
})

const post = (body) => agent().post('/api/applications').send(body)

const validFitCall = (over = {}) => ({
  fullName: 'Priya R',
  email: 'priya@example.in',
  phone: '9876500011',
  preferredSlots: ['sat-10-1'],
  preferredWeek: 'Next week',
  consent: true,
  ...over,
})

describe('flagship application intake', () => {
  it('accepts a complete application and stores it as New', async () => {
    const res = await post(validApplication()).expect(201)
    expect(res.body.ok).toBe(true)

    const saved = await savedApplication(res.body.id)
    expect(saved).toMatchObject({
      email: 'dinesh@example.in',
      trackPreference: 'track-b',
      status: 'New',
      consentWhatsapp: true,
    })
    expect(saved.liveAvailability).toEqual(['weekday-evening'])
  })

  /**
   * The gotcha is a plain-text question in the browser. A bot posting to the
   * API never renders it, so the answer has to be checked here too.
   */
  it('rejects a wrong or missing anti-spam answer', async () => {
    await post(validApplication({ batchGotcha: 'whatever' })).expect(400)
    await post(validApplication({ batchGotcha: '' })).expect(400)
    // The drop's pattern allows a bare "4" and any casing of "Batch".
    await post(validApplication({ batchGotcha: '4', email: 'a@b.in' })).expect(201)
    await post(validApplication({ batchGotcha: 'batch 4', email: 'c@d.in' })).expect(201)
  })

  it('refuses to record an application without both consents', async () => {
    await post(validApplication({ consentWhatsapp: false })).expect(400)
    await post(validApplication({ consentAccurate: false })).expect(400)
  })

  it('requires at least one live-session availability', async () => {
    await post(validApplication({ liveAvailability: [] })).expect(400)
  })

  it('enforces the essay word limits', async () => {
    // curriculumHook is capped at 80 words.
    await post(validApplication({ curriculumHook: 'word '.repeat(90) })).expect(400)
  })

  it('requires the scholarship essay only when a scholarship is requested', async () => {
    await post(validApplication({ paymentPlan: 'scholarship' })).expect(400)
    const res = await post(
      validApplication({
        paymentPlan: 'scholarship',
        scholarshipCase: 'Funding this myself while freelancing.',
        email: 'scholar@example.in',
      }),
    ).expect(201)
    const saved = await savedApplication(res.body.id)
    expect(saved.scholarshipCase).toMatch(/Funding this myself/)
  })

  /**
   * Someone can fill the experienced block, change their level to beginner and
   * submit. The stale spend figure must not be stored — a reviewer would read
   * it as current.
   */
  it('drops answers belonging to a branch that is no longer on screen', async () => {
    const res = await post(
      validApplication({
        experienceLevel: 'complete-beginner',
        monthlySpend: '₹5L+',
        toolsUsed: 'Meta Ads',
        portfolioUrl: 'https://example.com',
        starterCourses: 'SEO Mastery',
      }),
    ).expect(201)

    const saved = await savedApplication(res.body.id)
    expect(saved.monthlySpend).toBeNull()
    expect(saved.toolsUsed).toBeNull()
    expect(saved.portfolioUrl).toBeNull()
    // The beginner-only answer is the one that belongs, so it is kept.
    expect(saved.starterCourses).toBe('SEO Mastery')
  })

  it('drops the scholarship essay when the plan is pay-in-full', async () => {
    const res = await post(
      validApplication({ paymentPlan: 'full', scholarshipCase: 'left over from before' }),
    ).expect(201)
    const saved = await savedApplication(res.body.id)
    expect(saved.scholarshipCase).toBeNull()
  })
})

describe('fit call intake', () => {
  it('accepts a request and stores it as Requested', async () => {
    const res = await agent().post('/api/fit-calls').send(validFitCall()).expect(201)
    const saved = await savedFitCall(res.body.id)
    expect(saved).toMatchObject({ email: 'priya@example.in', status: 'Requested', consent: true })
  })

  it('requires consent and at least one slot', async () => {
    await agent()
      .post('/api/fit-calls')
      .send(validFitCall({ consent: false }))
      .expect(400)
    await agent()
      .post('/api/fit-calls')
      .send(validFitCall({ preferredSlots: [] }))
      .expect(400)
  })
})

describe('intake inboxes', () => {
  it('keeps both inboxes behind the admin role', async () => {
    await agent().get('/api/admin/applications').expect(401)
    await agent().get('/api/admin/fit-calls').expect(401)
  })

  it('lists applications with board counts and hides the essays', async () => {
    await post(validApplication()).expect(201)
    const as = await adminAgent()

    const res = await as('get', '/api/admin/applications').expect(200)
    expect(res.body.total).toBe(1)
    expect(res.body.counts.New).toBe(1)
    // The list omits the long answers; the detail route serves them.
    expect(res.body.items[0].whyFlagship).toBeUndefined()

    const detail = await as('get', `/api/admin/applications/${res.body.items[0]._id}`).expect(200)
    expect(detail.body.whyFlagship).toMatch(/mentor review/)
  })

  /**
   * Both timestamps answer "how long did we take to decide". Re-saving a
   * decided application must not keep pushing them forward.
   */
  it('stamps reviewedAt and decidedAt once each', async () => {
    const created = await post(validApplication()).expect(201)
    const as = await adminAgent()
    const url = `/api/admin/applications/${created.body.id}`

    const shortlisted = await as('put', url).send({ status: 'Shortlisted' }).expect(200)
    expect(shortlisted.body.reviewedAt).toBeTruthy()
    expect(shortlisted.body.decidedAt).toBeFalsy()

    const accepted = await as('put', url).send({ status: 'Accepted' }).expect(200)
    expect(accepted.body.reviewedAt).toBe(shortlisted.body.reviewedAt)
    expect(accepted.body.decidedAt).toBeTruthy()

    const rejected = await as('put', url).send({ status: 'Rejected' }).expect(200)
    expect(rejected.body.decidedAt).toBe(accepted.body.decidedAt)
  })

  it('refuses an unknown status', async () => {
    const created = await post(validApplication()).expect(201)
    const as = await adminAgent()
    await as('put', `/api/admin/applications/${created.body.id}`)
      .send({ status: 'Maybe' })
      .expect(400)
  })

  it('appends notes with their author', async () => {
    const created = await post(validApplication()).expect(201)
    const as = await adminAgent()
    const res = await as('post', `/api/admin/applications/${created.body.id}/notes`)
      .send({ body: 'Strong ship story — shortlist.' })
      .expect(200)
    expect(res.body.notes).toHaveLength(1)
    expect(res.body.notes[0].authorName).toBeTruthy()
  })

  /** A reviewer needs to see the applicant already asked for a call. */
  it('cross-links an application to fit calls from the same email', async () => {
    await post(validApplication({ email: 'both@example.in' })).expect(201)
    await agent()
      .post('/api/fit-calls')
      .send(validFitCall({ email: 'both@example.in' }))
      .expect(201)

    const as = await adminAgent()
    const list = await as('get', '/api/admin/applications').expect(200)
    const detail = await as('get', `/api/admin/applications/${list.body.items[0]._id}`).expect(200)
    expect(detail.body.fitCalls).toHaveLength(1)
    expect(detail.body.fitCalls[0].status).toBe('Requested')
  })
})
