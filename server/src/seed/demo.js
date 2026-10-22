/**
 * The fabricated dataset: demo accounts, their enrollments, certificates,
 * bookings, community posts and the invented CRM/marketing rows that make the
 * admin screens look populated.
 *
 * None of this is real content, so this half wipes freely — and that is exactly
 * why it must never reach production. Every entry point routes through
 * assertDestructiveAllowed() in guard.js before a connection is opened.
 *
 * It depends on the catalogue existing (courses are looked up by slug), but it
 * never rewrites it: seedContent() owns Course/Program/Workshop/BlogPost/
 * Channel/PracticeItem/Badge/PointRule/Setting.
 */
import * as M from '../models/index.js'
import { log } from './guard.js'

import { channels, posts } from './data/community.js'
import {
  customers,
  transactions,
  funnels,
  funnelLeads,
  emailLists,
  emailContacts,
  broadcasts,
  liveBookings,
  liveClasses,
  practiceItems,
} from './data/admin.js'
import { leaderboard } from './data/gamification.js'

/** Named in the production refusal message so the operator sees the blast radius. */
export const DEMO_COLLECTIONS = [
  'User',
  'Enrollment',
  'Certificate',
  'Transaction',
  'Customer',
  'Lead',
  'WorkshopRegistration',
  'LiveClass',
  'Booking',
  'LiveBooking',
  'Post',
  'Comment',
  'EmailList',
  'EmailContact',
  'Broadcast',
  'Funnel',
  'FunnelStep',
  'FunnelLead',
  'LeaderboardEntry',
]

const userSeeds = [
  {
    name: 'Priya Sharma',
    email: 'priya.sharma@email.com',
    role: 'student',
    avatarInitials: 'PS',
    streakDays: 12,
    hoursThisWeek: 6.5,
    seeds: 1840,
    weeklyGoalHours: 8,
    preferredLanguage: 'Tamil',
  },
  { name: 'Growth Scholar', email: 'team@growthscholar.in', role: 'admin', avatarInitials: 'GS' },
  { name: 'Aravinth R.', email: 'aravinth@growthscholar.in', role: 'admin', avatarInitials: 'AR' },
  {
    name: 'Sowndarya',
    email: 'sowndarya@email.com',
    role: 'student',
    avatarInitials: 'SO',
    seeds: 2480,
    streakDays: 21,
    hoursThisWeek: 9,
  },
  {
    name: 'Thiyagarajan',
    email: 'thiyagu@email.com',
    role: 'student',
    avatarInitials: 'TH',
    seeds: 2120,
  },
  {
    name: 'Anishmon A',
    email: 'anish@email.com',
    role: 'student',
    avatarInitials: 'AA',
    seeds: 1890,
  },
  { name: 'Gokul', email: 'gokul@email.com', role: 'student', avatarInitials: 'GO', seeds: 1640 },
  { name: 'Priya M', email: 'priya@email.com', role: 'student', avatarInitials: 'PM', seeds: 1510 },
]

const enrollmentPlan = [
  { slug: 'seo-mastery', progressPct: 62, status: 'Active' },
  { slug: 'meta-ads-foundations', progressPct: 35, status: 'Active' },
  { slug: 'copywriting-sprint', progressPct: 80, status: 'Active' },
  { slug: 'funnel-building-lab', progressPct: 15, status: 'Active' },
  { slug: 'digital-marketing-starter', progressPct: 100, status: 'Completed' },
  { slug: 'social-media-basics', progressPct: 0, status: 'Not started' },
]

export async function seedDemo({ seedPassword, keepUsers = false }) {
  /* --------------------- the catalogue must be there --------------------- */
  const courseDocs = await M.Course.find({})
  const bySlug = Object.fromEntries(courseDocs.map((c) => [c.slug, c]))
  const missing = enrollmentPlan.map((p) => p.slug).filter((slug) => !bySlug[slug])
  if (missing.length) {
    throw new Error(
      `the demo dataset needs catalogue content that is not in this database ` +
        `(missing course slugs: ${missing.join(', ')}). ` +
        `Run \`npm run seed\` first, or \`npm run seed:all\` to do both.`,
    )
  }

  /* ------------------------------- wipe ---------------------------------- */
  // Demo-owned collections only. The catalogue is left alone so this can be
  // re-run on top of freshly published content.
  const wipe = [
    M.Enrollment,
    M.Certificate,
    M.Lead,
    M.WorkshopRegistration,
    M.LiveClass,
    M.Booking,
    M.LiveBooking,
    M.Post,
    M.Comment,
    M.Customer,
    M.Transaction,
    M.EmailList,
    M.EmailContact,
    M.Broadcast,
    M.Funnel,
    M.FunnelStep,
    M.FunnelLead,
    M.LeaderboardEntry,
  ]
  await Promise.all(wipe.map((model) => model.deleteMany({})))
  if (!keepUsers) await M.User.deleteMany({})
  // These live on content documents but belong to the demo users, so they would
  // otherwise dangle on ids that no longer exist.
  await M.PracticeItem.updateMany({}, { $set: { attempts: [] } })
  await M.Channel.updateMany({}, { $set: { memberIds: [] } })
  log(`cleared ${wipe.length} demo collections${keepUsers ? ' (users kept)' : ''}`)

  /* ------------------------------- users --------------------------------- */
  const passwordHash = await M.User.hashPassword(seedPassword)

  const users = {}
  for (const seed of userSeeds) {
    const existing = keepUsers ? await M.User.findOne({ email: seed.email }) : null
    users[seed.email] = existing || (await M.User.create({ ...seed, passwordHash }))
  }
  const userIds = Object.values(users).map((u) => u._id)
  log(`users: ${Object.keys(users).length}`)

  /* ------------------------ student learning state ----------------------- */
  const priya = users['priya.sharma@email.com']
  const seoCourse = bySlug['seo-mastery']

  // Priya is 62% through SEO Mastery, on Module 3 · Lesson 2 — as the old dashboard showed.
  const seoLessons = seoCourse.sections.flatMap((s) => s.lessons)
  const completedCount = Math.round(seoLessons.length * 0.62)
  const module3 = seoCourse.sections[2]

  const enrollments = []
  for (const [i, plan] of enrollmentPlan.entries()) {
    const course = bySlug[plan.slug]
    const lessons = course.sections.flatMap((s) => s.lessons)
    const take = Math.round(lessons.length * (plan.progressPct / 100))
    // Derive the stored percentage from the lessons actually marked complete so
    // it agrees with what PATCH /enrollments/:id/progress recomputes later —
    // otherwise the number visibly jumps the first time a learner clicks.
    const progressPct = lessons.length ? Math.round((take / lessons.length) * 100) : 0
    enrollments.push({
      userId: priya._id,
      courseId: course._id,
      progressPct,
      status: plan.status,
      completedLessonIds: lessons.slice(0, take).map((l) => l._id),
      currentSectionId: plan.slug === 'seo-mastery' ? module3._id : course.sections[0]._id,
      currentLessonId:
        plan.slug === 'seo-mastery'
          ? module3.lessons[1]._id
          : lessons[Math.min(take, lessons.length - 1)]._id,
      lastAccessedAt: new Date(Date.now() - i * 86400000),
      enrolledAt: new Date(Date.now() - (i + 3) * 86400000),
    })
  }

  // a few peers enrolled so the admin "Students" tab is not empty
  for (const email of ['sowndarya@email.com', 'anish@email.com', 'gokul@email.com']) {
    enrollments.push({
      userId: users[email]._id,
      courseId: seoCourse._id,
      progressPct: 45,
      status: 'Active',
      completedLessonIds: seoLessons
        .slice(0, Math.round(seoLessons.length * 0.45))
        .map((l) => l._id),
      lastAccessedAt: new Date(),
    })
  }
  await M.Enrollment.insertMany(enrollments)
  log(
    `enrollments: ${enrollments.length} (SEO Mastery at ${enrollments[0].progressPct}%, ` +
      `${completedCount}/${seoLessons.length} lessons)`,
  )

  await M.Certificate.insertMany([
    {
      userId: priya._id,
      courseId: bySlug['digital-marketing-starter']._id,
      courseTitle: 'Digital Marketing Starter',
      issuedAt: new Date('2026-06-18'),
      credentialId: 'GS-DMS-2026-0431',
      status: 'Issued',
    },
    {
      userId: priya._id,
      courseId: seoCourse._id,
      courseTitle: 'SEO Mastery',
      credentialId: 'GS-SEO-2026-PENDING',
      status: 'In progress',
    },
  ])

  /* --------------------- practice attempts (demo user) -------------------- */
  for (const [i, item] of practiceItems.entries()) {
    await M.PracticeItem.updateOne(
      { title: item.title },
      {
        $set: {
          attempts: [
            {
              userId: priya._id,
              status: i === 0 ? 'Completed' : i === 1 ? 'In progress' : 'Not started',
              score: i === 0 ? 87 : undefined,
              attemptedAt: i < 2 ? new Date() : undefined,
            },
          ],
        },
      },
    )
  }

  /* --------------------------------- live -------------------------------- */
  const liveDocs = await M.LiveClass.insertMany(liveClasses)
  await M.Booking.insertMany([
    {
      liveClassId: liveDocs[0]._id,
      userId: priya._id,
      slot: liveDocs[0].startsAt,
      status: 'Booked',
    },
    {
      liveClassId: liveDocs[1]._id,
      userId: priya._id,
      slot: liveDocs[1].startsAt,
      status: 'Booked',
    },
  ])
  await M.LiveBooking.insertMany(liveBookings)

  /* ------------------------------ community ------------------------------ */
  // Channels themselves are catalogue content; only membership is demo data.
  await M.Channel.updateMany(
    { slug: { $in: channels.map((c) => c.slug) } },
    { $set: { memberIds: userIds } },
  )
  const channelDocs = await M.Channel.find({}).select('_id slug')
  const channelBySlug = Object.fromEntries(channelDocs.map((c) => [c.slug, c]))

  await M.Post.insertMany(
    posts
      .filter((p) => channelBySlug[p.channelSlug] && users[p.authorEmail])
      .map((p) => ({
        channelId: channelBySlug[p.channelSlug]._id,
        authorId: users[p.authorEmail]._id,
        body: p.body,
        pinned: !!p.pinned,
        commentCount: p.commentCount,
        likes: userIds.slice(0, Math.min(p.likeCount, userIds.length)),
        createdAt: new Date(Date.now() - p.minutesAgo * 60000),
      })),
  )
  log(`channel memberships: ${channelDocs.length}, posts: ${posts.length}`)

  /* ------------------------------ admin data ----------------------------- */
  const customerDocs = await M.Customer.insertMany(
    customers.map((c) => ({ ...c, userId: users[c.email]?._id })),
  )
  const customerByEmail = Object.fromEntries(customerDocs.map((c) => [c.email, c]))

  await M.Transaction.insertMany(
    transactions.map((t) => ({ ...t, customerId: customerByEmail[t.contact]?._id })),
  )

  const listDocs = await M.EmailList.insertMany(emailLists)
  const listByName = Object.fromEntries(listDocs.map((l) => [l.name, l]))

  await M.EmailContact.insertMany(
    emailContacts.map(({ lists, ...c }) => ({
      ...c,
      listIds: lists.map((n) => listByName[n]?._id).filter(Boolean),
    })),
  )

  await M.Broadcast.insertMany(
    broadcasts.map((b) => ({ ...b, sendToListId: listByName[b.sendToListName]?._id })),
  )

  for (const { steps, ...funnel } of funnels) {
    const doc = await M.Funnel.create(funnel)
    await M.FunnelStep.insertMany(steps.map((s) => ({ ...s, funnelId: doc._id })))
    if (funnel.slug === 'lead-magnet') {
      await M.FunnelLead.insertMany(funnelLeads.map((l) => ({ ...l, funnelId: doc._id })))
    }
  }
  log(`funnels: ${funnels.length}, customers: ${customerDocs.length}, lists: ${listDocs.length}`)

  /* ---------------------------- leaderboard ------------------------------ */
  await M.LeaderboardEntry.insertMany(
    leaderboard.map((e) => ({ ...e, userId: users[e.email]?._id })),
  )

  log('demo seed complete ✔')
  log('sign in as  priya.sharma@email.com   (student)')
  log('            team@growthscholar.in    (admin)')
  log('password:   the SEED_PASSWORD value from your .env (not printed)')
}
