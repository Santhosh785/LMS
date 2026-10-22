import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { requireFeature } from '../middleware/features.js'
import { asyncHandler } from '../middleware/error.js'
import {
  Enrollment,
  Certificate,
  PracticeItem,
  Badge,
  LeaderboardEntry,
  LiveClass,
  Booking,
  Course,
  Post,
  WorkshopRegistration,
} from '../models/index.js'
import { cfg } from '../services/runtimeConfig.js'

const router = Router()
router.use(requireAuth)

router.get(
  '/enrollments',
  asyncHandler(async (req, res) => {
    const items = await Enrollment.find({ userId: req.user._id })
      .populate('courseId', 'title slug thumbClass hours kind type mediaLabel languages rating')
      .sort({ lastAccessedAt: -1 })
      .lean()
    res.json({ items })
  }),
)

/** Everything the student dashboard needs in one round trip. */
router.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const [enrollments, upcoming] = await Promise.all([
      Enrollment.find({ userId: req.user._id })
        .populate('courseId', 'title slug thumbClass hours kind type sections mediaLabel topic')
        .sort({ lastAccessedAt: -1 })
        .lean(),
      LiveClass.find({ startsAt: { $gte: new Date() } })
        .sort({ startsAt: 1 })
        .limit(3)
        .lean(),
    ])

    const current =
      enrollments.find((e) => e.progressPct > 0 && e.progressPct < 100) || enrollments[0]

    /**
     * The three sections the 2026 redesign added to this page. Each is built
     * from something the database actually records — the drop illustrated them
     * with invented rows (a "Module 3 quiz", "+40 Seeds"), and there is no quiz
     * deadline or activity log to read those from. A section with nothing real
     * behind it returns empty and the page omits it.
     */
    const now = new Date()
    const [registrations, certificates, posts] = await Promise.all([
      // "Deadlines & next steps" — sessions this learner actually signed up for.
      WorkshopRegistration.find({ userId: req.user._id })
        .populate({
          path: 'workshopId',
          select: 'title slug startsAt mode venue',
          match: { startsAt: { $gte: now } },
        })
        .lean(),
      Certificate.find({ userId: req.user._id }).sort({ issuedAt: -1 }).limit(4).lean(),
      Post.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(4).select('body createdAt').lean(),
    ])

    const deadlines = [
      ...registrations
        .filter((r) => r.workshopId)
        .map((r) => ({
          kind: 'workshop',
          title: r.workshopId.title,
          body: r.workshopId.mode === 'offline' ? r.workshopId.venue : 'Live online · joining link by email',
          at: r.workshopId.startsAt,
          to: `/workshops/${r.workshopId.slug}`,
        })),
      ...upcoming.map((c) => ({
        kind: 'live',
        title: c.topic || c.title,
        body: 'Live class',
        at: c.startsAt,
        to: '/student/live',
      })),
    ]
      .sort((a, b) => new Date(a.at) - new Date(b.at))
      .slice(0, 4)

    const activity = [
      ...certificates.map((c) => ({
        icon: '🎓',
        text: `Certificate unlocked: ${c.courseTitle}`,
        at: c.issuedAt,
      })),
      ...enrollments
        .filter((e) => e.progressPct === 100 && e.lastAccessedAt)
        .map((e) => ({
          icon: '✅',
          text: `Completed ${e.courseId?.title || 'a course'}`,
          at: e.lastAccessedAt,
        })),
      ...posts.map((p) => ({
        icon: '💬',
        text: `Posted in the community: “${p.body.slice(0, 60)}${p.body.length > 60 ? '…' : ''}”`,
        at: p.createdAt,
      })),
    ]
      .sort((a, b) => new Date(b.at) - new Date(a.at))
      .slice(0, 5)

    /**
     * "Recommended for you" — published courses in the topics this learner is
     * already studying, minus the ones they hold. No enrolments means no
     * signal, so the section stays empty rather than showing a generic list.
     */
    const enrolledIds = enrollments.map((e) => e.courseId?._id).filter(Boolean)
    const topics = [...new Set(enrollments.map((e) => e.courseId?.topic).filter(Boolean))]
    const recommended = topics.length
      ? await Course.find({
          topic: { $in: topics },
          _id: { $nin: enrolledIds },
          status: 'Published',
          visibility: 'Public',
        })
          .select('title slug topic summary thumbClass mediaLabel amount price')
          .sort({ popularity: -1 })
          .limit(3)
          .lean()
      : []

    // Seeds and the streak are only meaningful once something awards them.
    // While gamification is off they are left out of the payload entirely
    // rather than sent as a zero the dashboard would have to render.
    const gamification = cfg.features.gamification
      ? { streakDays: req.user.streakDays, seeds: req.user.seeds }
      : {}

    res.json({
      user: {
        name: req.user.name,
        avatarInitials: req.user.avatarInitials,
        hoursThisWeek: req.user.hoursThisWeek,
        weeklyGoalHours: req.user.weeklyGoalHours,
        ...gamification,
      },
      stats: {
        hoursThisWeek: req.user.hoursThisWeek,
        activeCourses: enrollments.filter((e) => e.status === 'Active').length,
        ...gamification,
      },
      current,
      inProgress: enrollments.filter((e) => e.progressPct > 0 && e.progressPct < 100),
      upcoming,
      deadlines,
      activity,
      recommended,
    })
  }),
)

router.get(
  '/certificates',
  asyncHandler(async (req, res) => {
    const items = await Certificate.find({ userId: req.user._id }).sort({ issuedAt: -1 }).lean()
    res.json({ items })
  }),
)

// Badges, seeds and the weekly rank all come from the inert gamification data,
// so the whole endpoint goes away with the flag.
router.get(
  '/achievements',
  requireFeature('gamification'),
  asyncHandler(async (req, res) => {
    const [badges, rank] = await Promise.all([
      Badge.find().lean(),
      LeaderboardEntry.findOne({ userId: req.user._id, period: 'week' }).lean(),
    ])
    res.json({
      seeds: req.user.seeds,
      streakDays: req.user.streakDays,
      badges: badges.map((b) => ({ ...b, earned: req.user.seeds >= (b.seedsThreshold || 0) })),
      rank: rank?.rank ?? null,
    })
  }),
)

router.get(
  '/practice',
  asyncHandler(async (req, res) => {
    const items = await PracticeItem.find().lean()
    res.json({
      items: items.map((item) => {
        const attempt = item.attempts?.find((a) => String(a.userId) === String(req.user._id))
        // Destructured out on purpose: `attempts` holds every other student's
        // scores, and the caller only gets their own, resolved above.
        const { attempts: _attempts, ...rest } = item
        return { ...rest, status: attempt?.status || 'Not started', score: attempt?.score ?? null }
      }),
    })
  }),
)

router.get(
  '/bookings',
  asyncHandler(async (req, res) => {
    const items = await Booking.find({ userId: req.user._id }).populate('liveClassId').lean()
    res.json({ items })
  }),
)

export default router
