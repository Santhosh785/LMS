import { Router } from 'express'
import { asyncHandler, HttpError } from '../middleware/error.js'
import { and, eq } from 'drizzle-orm'
import { courses } from '../db/schema/index.js'
import {
  findCourse,
  findPublicBySlug,
  listPublic,
  listPublicFacets,
  publicCourseWhere,
} from '../db/repos/courses.js'
import {
  effectiveVideoStatus,
  findLesson,
  isBunnyConfigured,
  signPlaybackUrl,
} from '../services/bunny.js'

const router = Router()

/**
 * The catalogue. Filtering, sorting and paging live in the courses repo so the
 * SEO resolver and the sitemap apply exactly the same visibility rule; the API
 * keeps its `skip` parameter name for paging.
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await listPublic({ ...req.query, offset: req.query.skip }))
  }),
)

/** Distinct facet values so the filter sidebar can render from real data. */
router.get(
  '/facets',
  asyncHandler(async (_req, res) => {
    res.json(await listPublicFacets())
  }),
)

router.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    // Same visibility rule as the catalogue — otherwise a Draft course stays
    // fully reachable, and buyable, to anyone holding its slug. The repo also
    // strips the video ids: the curriculum is a selling point, they are not.
    const course = await findPublicBySlug(req.params.slug)
    if (!course) throw new HttpError(404, 'Course not found')
    res.json(course)
  }),
)

/**
 * A signed URL for a free-preview lesson, for anyone — no account needed.
 *
 * The paywall still holds: only a lesson an admin explicitly marked
 * `isFreePreview` on a published, public course is ever signed here, and every
 * other lesson answers the same 404 whether it exists or not, so this cannot be
 * used to probe the paid curriculum. The URL is as short-lived as a paying
 * student's.
 */
router.get(
  '/:slug/preview/:lessonId',
  asyncHandler(async (req, res) => {
    const notAvailable = () =>
      new HttpError(404, 'This lesson is not available as a preview', {
        code: 'PREVIEW_NOT_AVAILABLE',
      })

    const course = await findCourse(
      and(eq(courses.slug, String(req.params.slug).toLowerCase()), publicCourseWhere),
    )
    if (!course) throw notAvailable()
    const found = findLesson(course, req.params.lessonId)
    const lesson = found?.lesson
    if (!lesson?.isFreePreview || lesson.isDraft) throw notAvailable()
    if ((lesson.contentType || 'Video') !== 'Video' || !lesson.bunnyVideoId) throw notAvailable()
    if (effectiveVideoStatus(lesson) !== 'ready') {
      throw new HttpError(409, 'This preview is still being processed — check back shortly', {
        code: 'VIDEO_PROCESSING',
      })
    }
    if (!isBunnyConfigured()) {
      throw new HttpError(503, 'Video playback is temporarily unavailable', {
        code: 'PLAYBACK_UNCONFIGURED',
      })
    }

    const { url, expiresAt, ttlSeconds } = signPlaybackUrl(lesson.bunnyVideoId)
    res.set('Cache-Control', 'no-store') // a signed URL must not sit in any cache
    res.json({ url, expiresAt, ttlSeconds, lessonId: String(lesson._id), title: lesson.name })
  }),
)

export default router
