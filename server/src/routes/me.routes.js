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
        .populate('courseId', 'title slug thumbClass hours kind type sections mediaLabel')
        .sort({ lastAccessedAt: -1 })
        .lean(),
      LiveClass.find({ startsAt: { $gte: new Date() } })
        .sort({ startsAt: 1 })
        .limit(3)
        .lean(),
    ])

    const current =
      enrollments.find((e) => e.progressPct > 0 && e.progressPct < 100) || enrollments[0]

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
