import { describe, expect, it } from 'vitest'
import { Course, Enrollment } from '../src/models/index.js'
import { agent, freeCourse, paidCourse, signUp } from './helpers/factories.js'

/**
 * The paywall (task 6).
 *
 * This is the bug that shipped: `POST /api/enrollments` never read
 * `course.price`, so every paid course was free to anyone with an account while
 * the course page advertised ₹2,499. Nobody notices free access until the
 * revenue is missing, which is exactly why it needs a test.
 */
describe('paywall', () => {
  it('refuses self-enrolment in a paid course with 402 and the checkout path', async () => {
    const course = await paidCourse()
    const { cookie } = await signUp()

    const res = await agent()
      .post('/api/enrollments')
      .set('Cookie', cookie)
      .send({ slug: course.slug })

    expect(res.status).toBe(402)
    expect(res.body.details.checkoutPath).toBe('/checkout/seo-mastery')
  })

  it('creates no enrollment as a side effect of the 402', async () => {
    const course = await paidCourse()
    const { cookie, user } = await signUp()

    await agent().post('/api/enrollments').set('Cookie', cookie).send({ slug: course.slug })

    expect(await Enrollment.countDocuments({ userId: user._id })).toBe(0)
    // The counter must not move either — a refused purchase is not an enrolment.
    expect((await Course.findById(course._id)).enrolledCount).toBe(0)
  })

  it('still enrols in a free course', async () => {
    const course = await freeCourse()
    const { cookie, user } = await signUp()

    const res = await agent()
      .post('/api/enrollments')
      .set('Cookie', cookie)
      .send({ slug: course.slug })

    expect(res.status).toBe(201)
    const enrollment = await Enrollment.findOne({ userId: user._id })
    expect(enrollment).toBeTruthy()
    expect(enrollment.source).toBe('free')
    expect(enrollment.expiresAt).toBeNull()
  })

  it('is idempotent for a free course — enrolling twice yields one enrollment', async () => {
    const course = await freeCourse()
    const { cookie, user } = await signUp()

    await agent().post('/api/enrollments').set('Cookie', cookie).send({ slug: course.slug })
    await agent().post('/api/enrollments').set('Cookie', cookie).send({ slug: course.slug })

    expect(await Enrollment.countDocuments({ userId: user._id })).toBe(1)
  })

  it('requires authentication', async () => {
    const course = await freeCourse()
    const res = await agent().post('/api/enrollments').send({ slug: course.slug })
    expect(res.status).toBe(401)
  })
})

/**
 * Enrolment expiry (task 6). `Course.pricingPlans` sells 12- and 6-month tiers,
 * and before `expiresAt` existed every one of them granted permanent access.
 */
describe('enrollment expiry', () => {
  it('denies course access past expiresAt, distinguishably from not-enrolled', async () => {
    const course = await paidCourse()
    const { cookie, user } = await signUp()
    await Enrollment.create({
      userId: user._id,
      courseId: course._id,
      expiresAt: new Date(Date.now() - 86_400_000),
      source: 'paid',
    })

    const res = await agent().get(`/api/enrollments/course/${course.slug}`).set('Cookie', cookie)

    expect(res.status).toBe(403)
    expect(res.body.details.code).toBe('ACCESS_EXPIRED')
    expect(res.body.details.code).not.toBe('NOT_ENROLLED')
  })

  it('reports NOT_ENROLLED when there is no enrollment at all', async () => {
    const course = await paidCourse()
    const { cookie } = await signUp()

    const res = await agent().get(`/api/enrollments/course/${course.slug}`).set('Cookie', cookie)

    expect(res.status).toBe(403)
    expect(res.body.details.code).toBe('NOT_ENROLLED')
  })

  it('treats a null expiresAt as lifetime access', async () => {
    const course = await paidCourse()
    const { cookie, user } = await signUp()
    await Enrollment.create({
      userId: user._id,
      courseId: course._id,
      expiresAt: null,
      source: 'paid',
    })

    const res = await agent().get(`/api/enrollments/course/${course.slug}`).set('Cookie', cookie)
    expect(res.status).toBe(200)
  })

  it('still allows access a moment before expiry', async () => {
    const course = await paidCourse()
    const { cookie, user } = await signUp()
    await Enrollment.create({
      userId: user._id,
      courseId: course._id,
      expiresAt: new Date(Date.now() + 60_000),
      source: 'paid',
    })

    const res = await agent().get(`/api/enrollments/course/${course.slug}`).set('Cookie', cookie)
    expect(res.status).toBe(200)
  })
})
