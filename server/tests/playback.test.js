import { describe, expect, it } from 'vitest'
import { Course, Enrollment } from '../src/models/index.js'
import { agent, firstLessonId, paidCourse, quizLessonId, signUp } from './helpers/factories.js'

/**
 * Playback authorization (task 8).
 *
 * Gating the page is cosmetic if the video URL is public — one shared link
 * bypasses payment for everyone. These assert that no path hands out a URL
 * without an active enrolment, and that the signing key never travels.
 */
describe('playback authorization', () => {
  const playback = (slug, lessonId, cookie) => {
    const req = agent().get(`/api/enrollments/course/${slug}/playback/${lessonId}`)
    return cookie ? req.set('Cookie', cookie) : req
  }

  it('refuses an unauthenticated request', async () => {
    const course = await paidCourse()
    const res = await playback(course.slug, firstLessonId(course))
    expect(res.status).toBe(401)
    expect(res.text).not.toContain('mediadelivery')
  })

  it('refuses a user who is not enrolled, with no URL', async () => {
    const course = await paidCourse()
    const { cookie } = await signUp()

    const res = await playback(course.slug, firstLessonId(course), cookie)

    expect(res.status).toBe(403)
    expect(res.body.details.code).toBe('NOT_ENROLLED')
    expect(res.text).not.toContain('mediadelivery')
  })

  it('refuses an expired enrollment, with no URL', async () => {
    const course = await paidCourse()
    const { cookie, user } = await signUp()
    await Enrollment.create({
      userId: user._id,
      courseId: course._id,
      expiresAt: new Date(Date.now() - 1000),
      source: 'paid',
    })

    const res = await playback(course.slug, firstLessonId(course), cookie)

    expect(res.status).toBe(403)
    expect(res.body.details.code).toBe('ACCESS_EXPIRED')
    expect(res.text).not.toContain('mediadelivery')
  })

  it('refuses a lesson id that belongs to a different course', async () => {
    const course = await paidCourse()
    const other = await Course.create({
      title: 'Other',
      slug: 'other-course',
      price: 'paid',
      amount: 999,
      sections: [{ name: 'M1', lessons: [{ name: 'Foreign', bunnyVideoId: 'foreign-guid' }] }],
    })
    const { cookie, user } = await signUp()
    await Enrollment.create({ userId: user._id, courseId: course._id, source: 'paid' })

    const res = await playback(course.slug, String(other.sections[0].lessons[0]._id), cookie)

    expect(res.status).toBe(403)
    expect(res.body.details.code).toBe('LESSON_NOT_IN_COURSE')
    expect(res.text).not.toContain('mediadelivery')
  })

  it('gives an enrolled user a signed, expiring URL', async () => {
    const course = await paidCourse()
    const { cookie, user } = await signUp()
    await Enrollment.create({ userId: user._id, courseId: course._id, source: 'paid' })

    const res = await playback(course.slug, firstLessonId(course), cookie)

    expect(res.status).toBe(200)
    expect(res.body.url).toContain('https://iframe.mediadelivery.net/embed/999999/video-guid-one')
    expect(res.body.url).toMatch(/[?&]token=[a-f0-9]{64}/)
    expect(res.body.url).toMatch(/[?&]expires=\d+/)
    expect(new Date(res.body.expiresAt).getTime()).toBeGreaterThan(Date.now())
    // A signed URL must not sit in any cache.
    expect(res.headers['cache-control']).toContain('no-store')
  })

  it('never puts BUNNY_SECURITY_KEY in a response', async () => {
    const course = await paidCourse()
    const { cookie, user } = await signUp()
    await Enrollment.create({ userId: user._id, courseId: course._id, source: 'paid' })

    const playbackRes = await playback(course.slug, firstLessonId(course), cookie)
    const playerRes = await agent()
      .get(`/api/enrollments/course/${course.slug}`)
      .set('Cookie', cookie)
    const publicRes = await agent().get(`/api/courses/${course.slug}`)

    for (const res of [playbackRes, playerRes, publicRes]) {
      expect(res.text).not.toContain('test-bunny-security-key')
    }
  })

  it('keeps signed URLs and video ids out of the curriculum payload', async () => {
    const course = await paidCourse()
    const { cookie, user } = await signUp()
    await Enrollment.create({ userId: user._id, courseId: course._id, source: 'paid' })

    const res = await agent().get(`/api/enrollments/course/${course.slug}`).set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.text).not.toContain('mediadelivery')
    expect(res.text).not.toContain('video-guid-one')
    // Replaced by a boolean, so the UI can still tell a lesson awaiting upload
    // from one ready to watch.
    expect(res.body.course.sections[0].lessons[0].hasVideo).toBe(true)
  })

  it('does not leak video ids on the public course page either', async () => {
    const course = await paidCourse()
    const res = await agent().get(`/api/courses/${course.slug}`)
    expect(res.text).not.toContain('video-guid-one')
  })

  it('refuses a non-video lesson rather than signing nothing', async () => {
    const course = await paidCourse()
    const { cookie, user } = await signUp()
    await Enrollment.create({ userId: user._id, courseId: course._id, source: 'paid' })

    const res = await playback(course.slug, quizLessonId(course), cookie)

    expect(res.status).toBe(400)
    expect(res.body.details.contentType).toBe('Quiz')
  })
})
