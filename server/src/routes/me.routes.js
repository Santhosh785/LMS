import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { requireFeature } from '../middleware/features.js'
import { asyncHandler } from '../middleware/error.js'
import { and, asc, desc, eq, gte, inArray, notInArray } from 'drizzle-orm'
import { db, withMongoId } from '../db/index.js'
import {
  badges as badgesTable,
  bookings,
  certificates,
  courses,
  enrollments,
  leaderboardEntries,
  liveClasses,
  posts,
  practiceAttempts,
  practiceItems,
  workshopRegistrations,
  workshops,
} from '../db/schema/index.js'
import { hydrateCourses } from '../db/repos/courses.js'
import { enrollmentDocs } from '../db/repos/enrollments.js'
import { cfg } from '../services/runtimeConfig.js'

const router = Router()
router.use(requireAuth)

const pick = (obj, keys) =>
  obj ? Object.fromEntries(keys.filter((k) => k in obj).map((k) => [k, obj[k]])) : obj

/**
 * The learner's enrollments, newest activity first, with `courseId` populated
 * to the listed course fields — the shape Mongoose's populate() produced and
 * the dashboard and "My courses" pages read.
 */
async function enrollmentsWithCourses(userId, fields) {
  const rows = await db
    .select()
    .from(enrollments)
    .where(eq(enrollments.userId, userId))
    .orderBy(desc(enrollments.lastAccessedAt))
  const docs = await enrollmentDocs(rows)
  const courseRows = rows.length
    ? await db
        .select()
        .from(courses)
        .where(
          inArray(
            courses.id,
            rows.map((r) => r.courseId),
          ),
        )
    : []
  const needsCurriculum = fields.includes('sections')
  const hydrated = needsCurriculum ? await hydrateCourses(courseRows) : withMongoId(courseRows)
  const byId = new Map(hydrated.map((c) => [c.id, pick(c, ['_id', 'id', ...fields])]))
  return docs.map((e) => ({ ...e, courseId: byId.get(e.courseId) || null }))
}

router.get(
  '/enrollments',
  asyncHandler(async (req, res) => {
    const items = await enrollmentsWithCourses(req.user.id, [
      'title',
      'slug',
      'thumbClass',
      'hours',
      'kind',
      'type',
      'mediaLabel',
      'languages',
      'rating',
    ])
    res.json({ items })
  }),
)

/** Everything the student dashboard needs in one round trip. */
router.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const [mine, upcoming] = await Promise.all([
      enrollmentsWithCourses(req.user.id, [
        'title',
        'slug',
        'thumbClass',
        'hours',
        'kind',
        'type',
        'sections',
        'mediaLabel',
        'topic',
      ]),
      db
        .select()
        .from(liveClasses)
        .where(gte(liveClasses.startsAt, new Date()))
        .orderBy(asc(liveClasses.startsAt))
        .limit(3)
        .then(withMongoId),
    ])
    const enrollments = mine

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
    const [registrations, certs, myPosts] = await Promise.all([
      // "Deadlines & next steps" — sessions this learner actually signed up for.
      db
        .select({
          title: workshops.title,
          slug: workshops.slug,
          startsAt: workshops.startsAt,
          mode: workshops.mode,
          venue: workshops.venue,
        })
        .from(workshopRegistrations)
        .innerJoin(workshops, eq(workshops.id, workshopRegistrations.workshopId))
        .where(and(eq(workshopRegistrations.userId, req.user.id), gte(workshops.startsAt, now)))
        .then((rows) => rows.map((workshopId) => ({ workshopId }))),
      db
        .select()
        .from(certificates)
        .where(eq(certificates.userId, req.user.id))
        .orderBy(desc(certificates.issuedAt))
        .limit(4),
      // Posts are keyed by `authorId`. The Mongo query filtered on a `userId`
      // field posts never had, so this section was always empty.
      db
        .select({ body: posts.body, createdAt: posts.createdAt })
        .from(posts)
        .where(eq(posts.authorId, req.user.id))
        .orderBy(desc(posts.createdAt))
        .limit(4),
    ])

    const deadlines = [
      ...registrations
        .filter((r) => r.workshopId)
        .map((r) => ({
          kind: 'workshop',
          title: r.workshopId.title,
          body:
            r.workshopId.mode === 'offline'
              ? r.workshopId.venue
              : 'Live online · joining link by email',
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
      ...certs.map((c) => ({
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
      ...myPosts.map((p) => ({
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
      ? await db
          .select({
            id: courses.id,
            title: courses.title,
            slug: courses.slug,
            topic: courses.topic,
            summary: courses.summary,
            thumbClass: courses.thumbClass,
            mediaLabel: courses.mediaLabel,
            amount: courses.amount,
            price: courses.price,
          })
          .from(courses)
          .where(
            and(
              inArray(courses.topic, topics),
              ...(enrolledIds.length ? [notInArray(courses.id, enrolledIds)] : []),
              eq(courses.status, 'Published'),
              eq(courses.visibility, 'Public'),
            ),
          )
          .orderBy(desc(courses.popularity))
          .limit(3)
          .then(withMongoId)
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
    const items = await db
      .select()
      .from(certificates)
      .where(eq(certificates.userId, req.user.id))
      .orderBy(desc(certificates.issuedAt))
    res.json({ items: withMongoId(items) })
  }),
)

// Badges, seeds and the weekly rank all come from the inert gamification data,
// so the whole endpoint goes away with the flag.
router.get(
  '/achievements',
  requireFeature('gamification'),
  asyncHandler(async (req, res) => {
    const [badges, [rank]] = await Promise.all([
      db.select().from(badgesTable).then(withMongoId),
      db
        .select()
        .from(leaderboardEntries)
        .where(
          and(eq(leaderboardEntries.userId, req.user.id), eq(leaderboardEntries.period, 'week')),
        )
        .limit(1),
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
    // Only this learner's attempts are read at all — other students' scores
    // never leave the database, which the Mongo version had to strip by hand.
    const [items, attempts] = await Promise.all([
      db.select().from(practiceItems),
      db.select().from(practiceAttempts).where(eq(practiceAttempts.userId, req.user.id)),
    ])
    res.json({
      items: items.map((item) => {
        const attempt = attempts.find((a) => a.practiceItemId === item.id)
        return withMongoId({
          ...item,
          status: attempt?.status || 'Not started',
          score: attempt?.score ?? null,
        })
      }),
    })
  }),
)

router.get(
  '/bookings',
  asyncHandler(async (req, res) => {
    const rows = await db
      .select({ booking: bookings, liveClass: liveClasses })
      .from(bookings)
      .leftJoin(liveClasses, eq(liveClasses.id, bookings.liveClassId))
      .where(eq(bookings.userId, req.user.id))
    res.json({
      items: rows.map((r) => withMongoId({ ...r.booking, liveClassId: r.liveClass })),
    })
  }),
)

export default router
