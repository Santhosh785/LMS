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
 *
 * Accounts: only the demo accounts below are ever deleted, matched by email.
 * The Mongo version wiped every User document; with identities in Supabase Auth
 * that would also erase real people who signed up on a dev or staging project,
 * so the blast radius is now exactly the accounts this file creates.
 */
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import * as T from '../db/schema/index.js'
import { hydrateCourses } from '../db/repos/courses.js'
import { insertTransaction } from '../db/repos/transactions.js'
import { createAccount, deleteAccount, findUserByEmail } from '../db/repos/users.js'
import { log } from './guard.js'
import { insertAll } from './db.js'

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
  'User (the demo accounts only)',
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
  const courseDocs = await hydrateCourses(await db.select().from(T.courses))
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
  // Demo-owned tables only. The catalogue is left alone so this can be re-run
  // on top of freshly published content. Child tables (notes, likes, steps,
  // attendees, list memberships) go with their parents via ON DELETE CASCADE.
  const wipe = [
    T.enrollments,
    T.certificates,
    T.leads,
    T.workshopRegistrations,
    T.bookings,
    T.liveClasses,
    T.liveBookings,
    T.comments,
    T.posts,
    T.transactions,
    T.customers,
    T.broadcasts,
    T.emailContacts,
    T.emailLists,
    T.funnelLeads,
    T.funnelSteps,
    T.funnels,
    T.leaderboardEntries,
  ]
  for (const table of wipe) await db.delete(table)
  // These belong to the demo users but hang off catalogue rows, so they would
  // otherwise dangle on accounts that are about to be recreated.
  await db.delete(T.practiceAttempts)
  await db.delete(T.channelMembers)
  if (!keepUsers) {
    for (const seed of userSeeds) {
      const existing = await findUserByEmail(seed.email)
      if (existing) await deleteAccount(existing.id)
    }
  }
  log(`cleared ${wipe.length} demo tables${keepUsers ? ' (users kept)' : ''}`)

  /* ------------------------------- users --------------------------------- */
  const users = {}
  for (const seed of userSeeds) {
    const existing = keepUsers ? await findUserByEmail(seed.email) : null
    if (existing) {
      users[seed.email] = existing
      continue
    }
    const { email, name, role, avatarInitials, ...stats } = seed
    const created = await createAccount({ email, name, role, password: seedPassword })
    // Profile stats are not self-editable fields, so createAccount leaves them
    // out; the demo writes them directly.
    const [row] = await db
      .update(T.users)
      .set({ avatarInitials, ...stats })
      .where(eq(T.users.id, created.id))
      .returning()
    users[seed.email] = row
  }
  const userIds = Object.values(users).map((u) => u.id)
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
      userId: priya.id,
      courseId: course.id,
      progressPct,
      status: plan.status,
      completedLessonIds: lessons.slice(0, take).map((l) => l.id),
      currentSectionId: plan.slug === 'seo-mastery' ? module3.id : course.sections[0].id,
      currentLessonId:
        plan.slug === 'seo-mastery'
          ? module3.lessons[1].id
          : lessons[Math.min(take, lessons.length - 1)].id,
      lastAccessedAt: new Date(Date.now() - i * 86400000),
      enrolledAt: new Date(Date.now() - (i + 3) * 86400000),
    })
  }

  // a few peers enrolled so the admin "Students" tab is not empty
  for (const email of ['sowndarya@email.com', 'anish@email.com', 'gokul@email.com']) {
    enrollments.push({
      userId: users[email].id,
      courseId: seoCourse.id,
      progressPct: 45,
      status: 'Active',
      completedLessonIds: seoLessons
        .slice(0, Math.round(seoLessons.length * 0.45))
        .map((l) => l.id),
      lastAccessedAt: new Date(),
    })
  }
  for (const { completedLessonIds, ...e } of enrollments) {
    const [row] = await db.insert(T.enrollments).values(e).returning({ id: T.enrollments.id })
    if (completedLessonIds.length) {
      await db
        .insert(T.enrollmentCompletedLessons)
        .values(completedLessonIds.map((lessonId) => ({ enrollmentId: row.id, lessonId })))
    }
  }
  log(
    `enrollments: ${enrollments.length} (SEO Mastery at ${enrollments[0].progressPct}%, ` +
      `${completedCount}/${seoLessons.length} lessons)`,
  )

  await db.insert(T.certificates).values([
    {
      userId: priya.id,
      courseId: bySlug['digital-marketing-starter'].id,
      courseTitle: 'Digital Marketing Starter',
      issuedAt: new Date('2026-06-18'),
      credentialId: 'GS-DMS-2026-0431',
      status: 'Issued',
    },
    {
      userId: priya.id,
      courseId: seoCourse.id,
      courseTitle: 'SEO Mastery',
      credentialId: 'GS-SEO-2026-PENDING',
      status: 'In progress',
    },
  ])

  /* --------------------- practice attempts (demo user) -------------------- */
  for (const [i, item] of practiceItems.entries()) {
    const [stored] = await db
      .select({ id: T.practiceItems.id })
      .from(T.practiceItems)
      .where(eq(T.practiceItems.title, item.title))
    if (!stored) continue
    await db.insert(T.practiceAttempts).values({
      practiceItemId: stored.id,
      userId: priya.id,
      status: i === 0 ? 'Completed' : i === 1 ? 'In progress' : 'Not started',
      score: i === 0 ? 87 : null,
      attemptedAt: i < 2 ? new Date() : null,
    })
  }

  /* --------------------------------- live -------------------------------- */
  const liveDocs = await insertAll(T.liveClasses, liveClasses)
  await db.insert(T.bookings).values([
    { liveClassId: liveDocs[0].id, userId: priya.id, slot: liveDocs[0].startsAt, status: 'Booked' },
    { liveClassId: liveDocs[1].id, userId: priya.id, slot: liveDocs[1].startsAt, status: 'Booked' },
  ])
  await insertAll(T.liveBookings, liveBookings)

  /* ------------------------------ community ------------------------------ */
  // Channels themselves are catalogue content; only membership is demo data.
  const channelDocs = await db.select({ id: T.channels.id, slug: T.channels.slug }).from(T.channels)
  const channelBySlug = Object.fromEntries(channelDocs.map((c) => [c.slug, c]))
  const seededChannels = channelDocs.filter((c) => channels.some((s) => s.slug === c.slug))
  if (seededChannels.length && userIds.length) {
    await db
      .insert(T.channelMembers)
      .values(seededChannels.flatMap((c) => userIds.map((userId) => ({ channelId: c.id, userId }))))
  }

  const postSeeds = posts.filter((p) => channelBySlug[p.channelSlug] && users[p.authorEmail])
  for (const p of postSeeds) {
    const [row] = await db
      .insert(T.posts)
      .values({
        channelId: channelBySlug[p.channelSlug].id,
        authorId: users[p.authorEmail].id,
        body: p.body,
        pinned: !!p.pinned,
        commentCount: p.commentCount ?? 0,
        createdAt: new Date(Date.now() - p.minutesAgo * 60000),
      })
      .returning({ id: T.posts.id })
    const likers = userIds.slice(0, Math.min(p.likeCount || 0, userIds.length))
    if (likers.length) {
      await db.insert(T.postLikes).values(likers.map((userId) => ({ postId: row.id, userId })))
    }
  }
  log(`channel memberships: ${channelDocs.length}, posts: ${posts.length}`)

  /* ------------------------------ admin data ----------------------------- */
  const customerDocs = await insertAll(T.customers, customers, (c) => ({
    userId: users[c.email]?.id ?? null,
  }))
  const customerByEmail = Object.fromEntries(customerDocs.map((c) => [c.email, c]))

  for (const t of transactions) {
    await insertTransaction({ ...t, customerId: customerByEmail[t.contact]?.id })
  }

  const listDocs = await insertAll(T.emailLists, emailLists)
  const listByName = Object.fromEntries(listDocs.map((l) => [l.name, l]))

  for (const { lists, ...c } of emailContacts) {
    const [contact] = await insertAll(T.emailContacts, [c])
    const listIds = lists.map((n) => listByName[n]?.id).filter(Boolean)
    if (listIds.length) {
      await db
        .insert(T.emailContactLists)
        .values(listIds.map((listId) => ({ contactId: contact.id, listId })))
    }
  }

  await insertAll(T.broadcasts, broadcasts, (b) => ({
    sendToListId: listByName[b.sendToListName]?.id ?? null,
  }))

  for (const { steps, ...funnel } of funnels) {
    const [doc] = await insertAll(T.funnels, [funnel])
    await insertAll(T.funnelSteps, steps, () => ({ funnelId: doc.id }))
    if (funnel.slug === 'lead-magnet') {
      await insertAll(T.funnelLeads, funnelLeads, () => ({ funnelId: doc.id }))
    }
  }
  log(`funnels: ${funnels.length}, customers: ${customerDocs.length}, lists: ${listDocs.length}`)

  /* ---------------------------- leaderboard ------------------------------ */
  await insertAll(T.leaderboardEntries, leaderboard, (e) => ({
    userId: users[e.email]?.id ?? null,
  }))

  log('demo seed complete ✔')
  log('sign in as  priya.sharma@email.com   (student)')
  log('            team@growthscholar.in    (admin)')
  log('password:   the SEED_PASSWORD value from your .env (not printed)')
}
