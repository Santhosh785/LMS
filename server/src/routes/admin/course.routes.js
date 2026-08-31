import { Router } from 'express'
import { crudRouter } from '../../utils/crudRouter.js'
import { asyncHandler, HttpError } from '../../middleware/error.js'
import { Course, Enrollment } from '../../models/index.js'
import { effectiveVideoStatus, findLesson } from '../../services/bunny.js'
import {
  createVideo,
  deleteVideo,
  getVideo,
  isBunnyManagementConfigured,
  mapBunnyStatus,
  signTusUpload,
} from '../../services/bunnyApi.js'

const router = Router()

/* ------------------------- Lesson video (task 22) ------------------------- */

/** "754s" → "12:34"; hours only when needed, matching the lesson duration field. */
const formatDuration = (totalSeconds) => {
  const s = Math.max(0, Math.round(totalSeconds || 0))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

async function loadLesson(courseId, lessonId) {
  const course = await Course.findById(courseId)
  if (!course) throw new HttpError(404, 'Course not found')
  const found = findLesson(course, lessonId)
  if (!found) throw new HttpError(404, 'Lesson not found in this course')
  return { course, lesson: found.lesson }
}

/**
 * Starts an upload: creates the video object in Bunny, pins its GUID to the
 * lesson, and returns the TUS presign the browser uploads with. The file
 * itself never passes through this server. Re-posting replaces — the previous
 * Bunny video is deleted best-effort so the library does not silt up with
 * half-uploaded orphans.
 */
router.post(
  '/:id/lessons/:lessonId/video',
  asyncHandler(async (req, res) => {
    if (!isBunnyManagementConfigured()) {
      throw new HttpError(503, 'Video upload is not configured (BUNNY_API_KEY)', {
        code: 'UPLOAD_UNCONFIGURED',
      })
    }
    const { course, lesson } = await loadLesson(req.params.id, req.params.lessonId)

    const previousVideoId = lesson.bunnyVideoId
    let video
    try {
      video = await createVideo(`${course.title} — ${lesson.name}`)
    } catch (err) {
      console.error('[bunny] create video failed:', err.message)
      throw new HttpError(502, 'Bunny Stream did not accept the upload request', {
        code: 'BUNNY_UNAVAILABLE',
      })
    }

    lesson.bunnyVideoId = video.guid
    lesson.videoStatus = 'uploading'
    lesson.videoDurationSeconds = undefined
    await course.save()

    // Only after the new GUID is committed — losing the old video is
    // acceptable during a replace, losing the new one is not.
    if (previousVideoId && previousVideoId !== video.guid) {
      deleteVideo(previousVideoId).catch((err) =>
        console.warn(`[bunny] could not delete replaced video ${previousVideoId}: ${err.message}`),
      )
    }

    res.status(201).json({
      videoId: video.guid,
      videoStatus: 'uploading',
      tus: signTusUpload(video.guid),
    })
  }),
)

/**
 * Live encoding status. Terminal states answer from the document; anything
 * in flight asks Bunny and persists a transition when it sees one, so the
 * webhook (webhook.routes.js) is an accelerant, not a dependency — polling
 * alone reaches `ready` even if the webhook was never configured.
 */
router.get(
  '/:id/lessons/:lessonId/video',
  asyncHandler(async (req, res) => {
    const { course, lesson } = await loadLesson(req.params.id, req.params.lessonId)

    const stored = effectiveVideoStatus(lesson)
    const payload = {
      videoId: lesson.bunnyVideoId || null,
      videoStatus: stored,
      durationSeconds: lesson.videoDurationSeconds ?? null,
    }
    if (stored === 'none' || stored === 'ready' || stored === 'failed') {
      return res.json(payload)
    }

    if (!isBunnyManagementConfigured()) return res.json(payload)

    let video
    try {
      video = await getVideo(lesson.bunnyVideoId)
    } catch (err) {
      console.warn(`[bunny] status check failed for ${lesson.bunnyVideoId}: ${err.message}`)
      return res.json(payload) // stale beats a 502 for a poll loop
    }

    const next = mapBunnyStatus(video.status)
    // An upload in progress reports Bunny status 0 (created) — that must not
    // regress `uploading` to `processing`-forever if the browser dies mid-file.
    const resolved =
      lesson.videoStatus === 'uploading' && Number(video.status) === 0 ? 'uploading' : next

    if (resolved !== lesson.videoStatus) {
      lesson.videoStatus = resolved
      if (resolved === 'ready') {
        lesson.videoDurationSeconds = video.length || 0
        // Auto-fill the display duration unless an admin already wrote one.
        if (!lesson.duration || lesson.duration === '00:00') {
          lesson.duration = formatDuration(video.length)
        }
      }
      await course.save()
    }

    res.json({
      videoId: lesson.bunnyVideoId,
      videoStatus: resolved,
      durationSeconds: lesson.videoDurationSeconds ?? null,
      encodeProgress: video.encodeProgress ?? null,
    })
  }),
)

/** Detaches and deletes the lesson's video. Bunny 404s are already-done. */
router.delete(
  '/:id/lessons/:lessonId/video',
  asyncHandler(async (req, res) => {
    const { course, lesson } = await loadLesson(req.params.id, req.params.lessonId)
    if (!lesson.bunnyVideoId) return res.json({ ok: true })

    if (isBunnyManagementConfigured()) {
      try {
        await deleteVideo(lesson.bunnyVideoId)
      } catch (err) {
        console.error(`[bunny] delete failed for ${lesson.bunnyVideoId}: ${err.message}`)
        throw new HttpError(502, 'Bunny Stream refused the delete — try again', {
          code: 'BUNNY_UNAVAILABLE',
        })
      }
    }

    lesson.bunnyVideoId = undefined
    lesson.videoStatus = undefined
    lesson.videoDurationSeconds = undefined
    await course.save()
    res.json({ ok: true })
  }),
)

/** Per-tab saves. Each admin course tab writes only its own slice of the doc. */
const TAB_FIELDS = {
  settings: [
    'title',
    'slug',
    'topic',
    'languages',
    'categories',
    'tags',
    'summary',
    'durationLabel',
    'status',
    'visibility',
    'drmEnabled',
    'kind',
    'thumbClass',
    'image',
    'imageAlt',
  ],
  curriculum: ['sections'],
  pricing: ['pricingPlans', 'amount', 'strikeAmount', 'price'],
  drip: ['dripEnabled', 'dripSchedule'],
  automation: ['automationRules'],
  pages: ['overview', 'journey', 'tools', 'careers', 'whoShouldEnroll', 'faqs'],
}

/**
 * Keeps `price` and `amount` from contradicting each other.
 *
 * They are two fields describing one fact, and the admin UI could set the
 * amount without ever setting the flag — so a course created at ₹0 stayed
 * classified `paid`, its card rendered "Free" (the card reads `amount`), and
 * the homepage's "Free Courses" tab (which reads `price`) never showed it.
 *
 * Whichever of the two the caller supplied wins, and the other is brought into
 * line. A caller that sends both is taken at its word except when they
 * disagree outright, where the amount is the more concrete statement.
 */
function reconcilePricing(patch, existing) {
  const has = (k) => patch[k] !== undefined && patch[k] !== null && patch[k] !== ''
  if (!has('price') && !has('amount')) return patch

  const amount = has('amount') ? Number(patch.amount) : Number(existing?.amount ?? 0)
  const price = has('price') ? patch.price : existing?.price

  if (has('amount')) {
    // ₹0 is free, anything above it is paid — regardless of the stale flag.
    return { ...patch, price: amount > 0 ? 'paid' : 'free' }
  }
  // Only the flag moved: a course marked free cannot keep a price on it.
  return price === 'free' ? { ...patch, amount: 0 } : patch
}

for (const [tab, fields] of Object.entries(TAB_FIELDS)) {
  router.put(
    `/:id/${tab}`,
    asyncHandler(async (req, res) => {
      let patch = Object.fromEntries(Object.entries(req.body).filter(([k]) => fields.includes(k)))
      if (fields.includes('price') || fields.includes('amount')) {
        const existing = await Course.findById(req.params.id).select('price amount').lean()
        patch = reconcilePricing(patch, existing)
      }
      const course = await Course.findByIdAndUpdate(req.params.id, patch, {
        new: true,
        runValidators: true,
      })
      if (!course) throw new HttpError(404, 'Course not found')
      res.json(course)
    }),
  )
}

router.post(
  '/:id/publish',
  asyncHandler(async (req, res) => {
    const course = await Course.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status === 'Draft' ? 'Draft' : 'Published' },
      { new: true },
    )
    if (!course) throw new HttpError(404, 'Course not found')
    res.json(course)
  }),
)

/** The Students tab — derived from enrollments, not its own collection. */
router.get(
  '/:id/students',
  asyncHandler(async (req, res) => {
    const enrollments = await Enrollment.find({ courseId: req.params.id })
      .populate('userId', 'name email')
      .sort({ lastAccessedAt: -1 })
      .lean()

    const items = enrollments.map((e) => ({
      id: e._id,
      name: e.userId?.name,
      email: e.userId?.email,
      progress: e.progressPct,
      lastActive: e.lastAccessedAt,
      status: e.status,
    }))
    res.json({ items, total: items.length })
  }),
)

/**
 * Create goes through the same reconciliation as the tab saves — the create
 * form collects an amount but no paid/free flag, so without this every new
 * course was born `paid` even at ₹0 and never appeared under "Free Courses".
 */
router.post(
  '/',
  asyncHandler(async (req, res, next) => {
    if (req.body?.amount !== undefined || req.body?.price !== undefined) {
      req.body = reconcilePricing(req.body, null)
    }
    next()
  }),
)

router.use(
  '/',
  crudRouter(Course, {
    searchFields: ['title', 'topic', 'slug'],
    sort: { createdAt: -1 },
  }),
)

export default router
