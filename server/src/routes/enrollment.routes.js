import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler, HttpError } from '../middleware/error.js'
import { Enrollment, Course } from '../models/index.js'
import { grantAccess, isExpired } from '../services/access.js'
import {
  effectiveVideoStatus,
  findLesson,
  isBunnyConfigured,
  signPlaybackUrl,
  stripVideoRefs,
} from '../services/bunny.js'

const router = Router()
router.use(requireAuth)

const countLessons = (course) =>
  (course.sections || []).reduce((sum, s) => sum + (s.lessons?.length || 0), 0)

/** Shared by the player state and the playback endpoint. */
async function requireActiveEnrollment(userId, slug) {
  const course = await Course.findOne({ slug }).lean()
  if (!course) throw new HttpError(404, 'Course not found')

  const enrollment = await Enrollment.findOne({ userId, courseId: course._id }).lean()
  if (!enrollment) {
    throw new HttpError(403, 'You are not enrolled in this course', { code: 'NOT_ENROLLED' })
  }
  // Distinct from NOT_ENROLLED so the player can say "your access expired"
  // — someone who paid and lapsed needs a renewal prompt, not a sales page.
  if (isExpired(enrollment)) {
    throw new HttpError(403, 'Your access to this course has expired', {
      code: 'ACCESS_EXPIRED',
      expiredAt: enrollment.expiresAt,
    })
  }
  return { course, enrollment }
}

/**
 * Self-enrolment, free courses only.
 *
 * This endpoint used to create an enrolment for any slug an authenticated user
 * posted, without ever reading `course.price` — which meant every paid course in
 * the catalogue was free to anyone with an account, while the course page
 * advertised a price. Paid courses now refuse outright and point at checkout.
 * Refusing rather than creating a pending enrolment means a bug in the payment
 * flow cannot accidentally leave someone holding access.
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const course = await Course.findOne(
      req.body.slug ? { slug: req.body.slug } : { _id: req.body.courseId },
    ).lean()
    if (!course) throw new HttpError(404, 'Course not found')

    if (course.price !== 'free') {
      throw new HttpError(402, 'This course must be purchased before you can access it', {
        code: 'PAYMENT_REQUIRED',
        checkoutPath: `/checkout/${course.slug}`,
        amount: course.amount,
        currency: 'INR',
      })
    }

    const { enrollment, created } = await grantAccess(req.user._id, course._id, {
      expiresAt: null,
      source: 'free',
    })
    res.status(created ? 201 : 200).json(enrollment)
  }),
)

/** Course player state — the enrollment plus the full curriculum tree. */
router.get(
  '/course/:slug',
  asyncHandler(async (req, res) => {
    const { course, enrollment } = await requireActiveEnrollment(req.user._id, req.params.slug)
    res.json({ course: stripVideoRefs(course), enrollment })
  }),
)

/**
 * A freshly signed, short-lived playback URL for exactly one lesson.
 *
 * Signed per request and never persisted — not on the course document, not in a
 * cache, not in the curriculum payload above. Checks run in order: authenticated
 * (the router-level requireAuth), enrolled, not expired, and the lesson actually
 * belongs to this course. Any failure returns 403 and no URL.
 */
router.get(
  '/course/:slug/playback/:lessonId',
  asyncHandler(async (req, res) => {
    const { course } = await requireActiveEnrollment(req.user._id, req.params.slug)

    const found = findLesson(course, req.params.lessonId)
    // 403 rather than 404: a lesson id from another course is an access failure,
    // and answering "no such lesson" would confirm which ids exist elsewhere.
    if (!found) {
      throw new HttpError(403, 'That lesson is not part of this course', {
        code: 'LESSON_NOT_IN_COURSE',
      })
    }

    const { lesson } = found
    if (lesson.contentType && lesson.contentType !== 'Video') {
      throw new HttpError(400, `"${lesson.name}" is not a video lesson`, {
        code: 'NOT_A_VIDEO',
        contentType: lesson.contentType,
      })
    }
    if (!lesson.bunnyVideoId) {
      throw new HttpError(404, 'No video has been attached to this lesson yet', {
        code: 'VIDEO_NOT_ATTACHED',
      })
    }
    // A GUID exists the moment an upload starts (task 22), long before Bunny
    // can play it — signing early would hand the student a broken frame.
    const videoStatus = effectiveVideoStatus(lesson)
    if (videoStatus === 'uploading' || videoStatus === 'processing') {
      throw new HttpError(409, 'This video is still being processed — check back shortly', {
        code: 'VIDEO_PROCESSING',
      })
    }
    if (videoStatus === 'failed') {
      // The student cannot fix this; word it as unavailable, not as their error.
      throw new HttpError(409, 'This video is temporarily unavailable', {
        code: 'VIDEO_FAILED',
      })
    }
    if (!isBunnyConfigured()) {
      // A misconfigured server must not read as a paywall problem to the student.
      throw new HttpError(503, 'Video playback is temporarily unavailable', {
        code: 'PLAYBACK_UNCONFIGURED',
      })
    }

    const { url, expiresAt, ttlSeconds } = signPlaybackUrl(lesson.bunnyVideoId)
    res.set('Cache-Control', 'no-store') // a signed URL must not sit in any cache
    res.json({ url, expiresAt, ttlSeconds, lessonId: String(lesson._id), title: lesson.name })
  }),
)

router.patch(
  '/:id/progress',
  asyncHandler(async (req, res) => {
    const enrollment = await Enrollment.findOne({ _id: req.params.id, userId: req.user._id })
    if (!enrollment) throw new HttpError(404, 'Enrollment not found')

    const course = await Course.findById(enrollment.courseId).lean()
    const { lessonId, sectionId, completed } = req.body

    if (lessonId) {
      const has = enrollment.completedLessonIds.some((id) => String(id) === String(lessonId))
      if (completed !== false && !has) enrollment.completedLessonIds.push(lessonId)
      if (completed === false && has) {
        enrollment.completedLessonIds = enrollment.completedLessonIds.filter(
          (id) => String(id) !== String(lessonId),
        )
      }
      enrollment.currentLessonId = lessonId
    }
    if (sectionId) enrollment.currentSectionId = sectionId

    const total = countLessons(course)
    enrollment.progressPct = total
      ? Math.round((enrollment.completedLessonIds.length / total) * 100)
      : 0
    enrollment.status =
      enrollment.progressPct >= 100
        ? 'Completed'
        : enrollment.progressPct > 0
          ? 'Active'
          : 'Not started'
    enrollment.lastAccessedAt = new Date()
    await enrollment.save()

    res.json(enrollment)
  }),
)

export default router
