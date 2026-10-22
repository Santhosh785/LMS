import { describe, expect, it } from 'vitest'
import {
  certificates,
  enrollments,
  workshopRegistrations,
  workshops,
} from '../src/db/schema/index.js'
import { insertTransaction } from '../src/db/repos/transactions.js'
import { insertRow } from './helpers/commerce.js'
import { agent, paidCourse, signUp, signUpAdmin } from './helpers/factories.js'

/**
 * The panels the 2026 redesign added to the two dashboards.
 *
 * The drop illustrated them with invented rows — a "Module 3 quiz" deadline,
 * "+40 Seeds", "1,286 visitors", a flat "+32%". None of those are things this
 * application records. What is asserted here is the opposite: each panel is
 * built from a real signal, and returns nothing when there is no signal, so
 * the UI never shows a figure that looks measured but isn't.
 */

const day = 86_400_000

describe('student dashboard panels', () => {
  it('returns empty panels for a learner with no history', async () => {
    const { cookie } = await signUp({ email: 'fresh@example.in' })
    const res = await agent().get('/api/me/dashboard').set('Cookie', cookie).expect(200)

    expect(res.body.deadlines).toEqual([])
    expect(res.body.activity).toEqual([])
    // No enrolments means no topic to recommend from — a generic list would be
    // a guess dressed up as personalisation.
    expect(res.body.recommended).toEqual([])
  })

  it('lists a registered future workshop as a deadline, and ignores past ones', async () => {
    const { cookie, user } = await signUp({ email: 'learner@example.in' })
    const soon = await insertRow(workshops, {
      title: 'SEO Live Workshop',
      slug: 'seo-live',
      startsAt: new Date(Date.now() + 3 * day),
      mode: 'online',
    })
    const past = await insertRow(workshops, {
      title: 'Old Workshop',
      slug: 'old-workshop',
      startsAt: new Date(Date.now() - 3 * day),
      mode: 'online',
    })
    await insertRow(workshopRegistrations, { workshopId: soon.id, userId: user.id })
    await insertRow(workshopRegistrations, { workshopId: past.id, userId: user.id })

    const res = await agent().get('/api/me/dashboard').set('Cookie', cookie).expect(200)
    expect(res.body.deadlines).toHaveLength(1)
    expect(res.body.deadlines[0]).toMatchObject({ kind: 'workshop', title: 'SEO Live Workshop' })
  })

  it('builds recent activity from certificates, newest first', async () => {
    const { cookie, user } = await signUp({ email: 'grad@example.in' })
    await insertRow(certificates, {
      userId: user.id,
      courseTitle: 'Copywriting Sprint',
      credentialId: 'GS-1',
      issuedAt: new Date(Date.now() - 2 * day),
    })
    await insertRow(certificates, {
      userId: user.id,
      courseTitle: 'SEO Mastery',
      credentialId: 'GS-2',
      issuedAt: new Date(),
    })

    const res = await agent().get('/api/me/dashboard').set('Cookie', cookie).expect(200)
    expect(res.body.activity[0].text).toContain('SEO Mastery')
    expect(res.body.activity[1].text).toContain('Copywriting Sprint')
  })

  /** The recommendation is "more of what you study", never what you already hold. */
  it('recommends courses in an enrolled topic, excluding the enrolled course', async () => {
    const { cookie, user } = await signUp({ email: 'seo@example.in' })
    const enrolled = await paidCourse({ slug: 'seo-one', title: 'SEO One', topic: 'SEO' })
    const other = await paidCourse({ slug: 'seo-two', title: 'SEO Two', topic: 'SEO' })
    await paidCourse({ slug: 'ppc-one', title: 'PPC One', topic: 'PPC' })
    await insertRow(enrollments, { userId: user.id, courseId: enrolled.id, progressPct: 40 })

    const res = await agent().get('/api/me/dashboard').set('Cookie', cookie).expect(200)
    const slugs = res.body.recommended.map((c) => c.slug)
    expect(slugs).toContain(other.slug)
    expect(slugs).not.toContain(enrolled.slug)
    expect(slugs).not.toContain('ppc-one')
  })
})

describe('admin dashboard panels', () => {
  const sale = (over = {}) =>
    insertTransaction({ product: 'SEO Mastery', amount: 1000, status: 'SUCCESS', ...over })

  it('splits sales by billing cycle', async () => {
    await sale({ amount: 2000, cycle: 'ONETIME' })
    await sale({ amount: 500, cycle: 'SUBSCRIPTION' })
    // A refund is not revenue and must not land in the breakdown.
    await sale({ amount: 9999, cycle: 'ONETIME', status: 'REFUNDED' })

    const { cookie } = await signUpAdmin()
    const res = await agent().get('/api/admin/stats').set('Cookie', cookie).expect(200)
    expect(res.body.salesBreakdown).toMatchObject({
      oneTime: 2000,
      subscription: 500,
      total: 2500,
    })
  })

  it('counts this month’s payments and compares to last month', async () => {
    const now = new Date()
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 2)
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 2)
    await sale({ amount: 200, date: thisMonth })
    await sale({ amount: 100, date: lastMonth })

    const { cookie } = await signUpAdmin()
    const res = await agent().get('/api/admin/stats').set('Cookie', cookie).expect(200)
    expect(res.body.thisMonth).toMatchObject({ revenue: 200, payments: 1, deltaPct: 100 })
  })

  /**
   * With no prior month there is nothing to compare against. The delta must be
   * null so the UI omits the arrow rather than printing a made-up percentage.
   */
  it('returns a null delta when there is no prior period', async () => {
    const now = new Date()
    await sale({ amount: 200, date: new Date(now.getFullYear(), now.getMonth(), 2) })

    const { cookie } = await signUpAdmin()
    const res = await agent().get('/api/admin/stats').set('Cookie', cookie).expect(200)
    expect(res.body.thisMonth.deltaPct).toBeNull()
  })

  it('reports real lead and signup counts', async () => {
    const { cookie } = await signUpAdmin()
    const res = await agent().get('/api/admin/stats').set('Cookie', cookie).expect(200)
    expect(res.body.overview.signups).toBeGreaterThan(0)
    expect(res.body.overview.leads).toBe(0)
    // No leads means no conversion rate to quote.
    expect(res.body.overview.leadConversionPct).toBeNull()
  })
})
