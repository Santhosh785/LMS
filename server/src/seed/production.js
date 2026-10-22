import { count, eq, inArray, gt, ne, or, and, isNotNull } from 'drizzle-orm'
import { db } from '../db/index.js'
import {
  certificates,
  courses as coursesTable,
  customers,
  enrollments,
  funnelLeads,
  leaderboardEntries,
  leads,
  transactions,
  users,
  workshopRegistrations,
} from '../db/schema/index.js'
import { hydrateCourses } from '../db/repos/courses.js'
import { createAccount, findUserByEmail, normaliseEmail } from '../db/repos/users.js'
import { supabaseAdmin } from '../services/supabaseAdmin.js'
import { error, log } from './guard.js'
import { cfg } from '../services/runtimeConfig.js'

/**
 * Going-live checks, kept out of `seedContent` so publishing content stays a
 * pure, idempotent write with no surprises.
 *
 *   admin   creates or repairs the single real operator account
 *   audit   proves the fabricated demo data never reached this database, and
 *           reports which courses are publishable
 *
 * Neither deletes anything. `audit` is read-only by construction.
 */

/* ------------------------- collections that must be empty ------------------ */

/**
 * Everything the demo seeder fabricates. On a live database these hold real
 * customers or nothing at all — a demo row here means a `seed:demo` was pointed
 * at production, and the numbers on the admin dashboard are fiction.
 */
const MUST_BE_CLEAN = [
  ['Transaction', transactions],
  ['Customer', customers],
  ['Enrollment', enrollments],
  ['Certificate', certificates],
  ['Lead', leads],
  ['FunnelLead', funnelLeads],
  ['LeaderboardEntry', leaderboardEntries],
  ['WorkshopRegistration', workshopRegistrations],
]

const countRows = async (table, where) => {
  const [{ n }] = await db.select({ n: count() }).from(table).where(where)
  return n
}

/** Enrolments per course id, from the real rows. */
async function realEnrollmentCounts() {
  const rows = await db
    .select({ courseId: enrollments.courseId, n: count() })
    .from(enrollments)
    .groupBy(enrollments.courseId)
  return new Map(rows.map((r) => [String(r.courseId), r.n]))
}

/** The fabricated people. Named so the audit can point at them specifically. */
const DEMO_EMAILS = [
  'priya.sharma@email.com',
  'sowndarya@email.com',
  'thiyagu@email.com',
  'anish@email.com',
  'gokul@email.com',
  'priya@email.com',
  'kavya@email.com',
  'ravi@email.com',
  'aravinth@growthscholar.in',
]

/* --------------------------------- admin ---------------------------------- */

/**
 * Creates the one real operator account, or resets its password.
 *
 * Uses SEED_PASSWORD, which the seed guard already requires to be at least eight
 * characters and which is never printed. Deliberately separate from the demo
 * seeder, whose whole job is to create six fake people alongside it.
 */
export async function ensureAdmin({ email, name, password }) {
  if (!password || password.length < 8) {
    throw new Error('SEED_PASSWORD must be set (>= 8 characters) to create the admin account')
  }

  const address = normaliseEmail(email)
  const existing = await findUserByEmail(address)

  if (existing) {
    const { error: authError } = await supabaseAdmin().auth.admin.updateUserById(existing.id, {
      password,
    })
    if (authError) throw new Error(`Supabase password update failed: ${authError.message}`)
    // Any outstanding reset link dies with the password change, and so does any
    // session issued before it — see middleware/auth.js.
    await db
      .update(users)
      .set({
        role: 'admin',
        name: name || existing.name,
        passwordChangedAt: new Date(),
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
      })
      .where(eq(users.id, existing.id))
    log(`admin: reset the password for existing account ${address}`)
    return { user: await findUserByEmail(address), created: false }
  }

  const user = await createAccount({
    email: address,
    password,
    name: name || 'Growth Scholar',
    role: 'admin',
  })
  log(`admin: created ${address}`)
  return { user, created: true }
}

/* --------------------------------- audit ---------------------------------- */

/** A course is deliverable when every lesson a student can reach has video. */
export function publishability(course) {
  const lessons = (course.sections || []).flatMap((s) => s.lessons || [])
  const live = lessons.filter((l) => !l.isDraft)
  const videoLessons = live.filter((l) => (l.contentType || 'Video') === 'Video')
  const missing = videoLessons.filter((l) => !l.bunnyVideoId)
  return {
    lessonCount: live.length,
    videoCount: videoLessons.length,
    missingVideo: missing.length,
    // No lessons at all is not "ready", it is an empty course.
    deliverable: live.length > 0 && videoLessons.length > 0 && missing.length === 0,
  }
}

/**
 * Read-only. Returns `{ ok, problems }` so a caller can exit non-zero, and logs
 * a human-readable report.
 */
export async function auditProduction({ adminEmail } = {}) {
  const problems = []

  /* --- demo-owned collections must be empty --- */
  log('')
  log('— transactional collections —')
  for (const [label, table] of MUST_BE_CLEAN) {
    const n = await countRows(table)
    if (n === 0) {
      log(`  ${label.padEnd(22)} empty ✔`)
    } else {
      log(`  ${label.padEnd(22)} ${n} row(s)`)
    }
  }
  log('  (a non-zero count is only a problem if it is demo data — see below)')

  /* --- fabricated accounts --- */
  log('')
  log('— accounts —')
  const demoUsers = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(inArray(users.email, DEMO_EMAILS))
  if (demoUsers.length) {
    problems.push(
      `${demoUsers.length} demo account(s) present: ${demoUsers.map((u) => u.email).join(', ')}`,
    )
    for (const u of demoUsers) log(`  DEMO ACCOUNT  ${u.name} <${u.email}>`)
  } else {
    log('  no demo accounts ✔')
  }

  const admins = await db.select({ email: users.email }).from(users).where(eq(users.role, 'admin'))
  log(`  admins: ${admins.map((a) => a.email).join(', ') || 'none'}`)
  if (!admins.length) problems.push('no admin account exists — nobody can approve a payment')
  if (adminEmail && !admins.some((a) => a.email === adminEmail)) {
    problems.push(`the expected admin ${adminEmail} does not exist`)
  }
  if (admins.length > 1) {
    log('  more than one admin — confirm each is a real operator')
  }

  const totalUsers = await countRows(users)
  log(`  total accounts: ${totalUsers}`)

  /* --- invented marketing numbers --- */
  log('')
  log('— course statistics —')
  const invented = await db
    .select()
    .from(coursesTable)
    .where(
      or(
        gt(coursesTable.rating, 0),
        and(isNotNull(coursesTable.enrolledLabel), ne(coursesTable.enrolledLabel, '')),
      ),
    )
  const realByCourse = await realEnrollmentCounts()
  for (const c of invented) {
    const real = realByCourse.get(String(c.id)) || 0
    if (c.rating > 0 || (c.enrolledCount || 0) > real) {
      problems.push(
        `course "${c.slug}" advertises rating ${c.rating} / ${c.enrolledCount} enrolled, but has ${real} real enrolment(s)`,
      )
      log(`  INVENTED  ${c.slug}: rating ${c.rating}, enrolled ${c.enrolledCount} (real: ${real})`)
    }
  }
  if (!problems.some((p) => p.startsWith('course "')))
    log('  no invented ratings or enrolment counts ✔')

  /* --- deliverability --- */
  log('')
  log('— publishable courses —')
  const courses = await hydrateCourses(await db.select().from(coursesTable))
  for (const c of courses) {
    const p = publishability(c)
    const flag = c.status === 'Published' && !p.deliverable ? 'NOT DELIVERABLE' : c.status
    log(
      `  ${String(flag).padEnd(16)} ${c.slug} — ${p.videoCount}/${p.lessonCount} video lesson(s), ${p.missingVideo} missing`,
    )
    if (c.status === 'Published' && !p.deliverable) {
      problems.push(
        `course "${c.slug}" is Published but ${p.missingVideo || 'all'} lesson(s) have no video attached`,
      )
    }
  }

  /* --- prices --- */
  log('')
  log('— prices —')
  const priced = await hydrateCourses(
    await db.select().from(coursesTable).where(eq(coursesTable.status, 'Published')),
    { curriculum: false },
  )
  for (const c of priced) {
    if (c.price === 'free') {
      log(`  ${c.slug}: free`)
      continue
    }
    const plans = (c.pricingPlans || [])
      .map((p) => `${p.name} ₹${p.price} (${p.access})`)
      .join(', ')
    log(`  ${c.slug}: ₹${c.amount} — ${plans || 'no pricing plans'}`)
    if (!c.amount) problems.push(`course "${c.slug}" is paid but has no amount set`)
  }

  /* --- summary --- */
  log('')
  if (problems.length) {
    error(`audit found ${problems.length} problem(s):`)
    problems.forEach((p) => error(`  • ${p}`))
  } else {
    log('audit clean ✔ — catalogue content only, no fabricated data')
  }

  return { ok: problems.length === 0, problems }
}

/**
 * Forces every course that cannot actually be delivered into Draft.
 *
 * A catalogue where some courses cannot be watched after payment is worse than a
 * smaller catalogue: the first is a refund and a bad review, the second is just
 * fewer things to buy. Never promotes a course to Published — that stays a
 * human decision in the admin console.
 */
export async function draftUndeliverableCourses({ dryRun = false } = {}) {
  const courses = await hydrateCourses(
    await db.select().from(coursesTable).where(eq(coursesTable.status, 'Published')),
  )
  const drafted = []
  for (const course of courses) {
    if (publishability(course).deliverable) continue
    drafted.push(course.slug)
    if (!dryRun) {
      await db.update(coursesTable).set({ status: 'Draft' }).where(eq(coursesTable.id, course.id))
    }
  }
  if (drafted.length) {
    log(
      `${dryRun ? 'would move' : 'moved'} ${drafted.length} undeliverable course(s) to Draft: ${drafted.join(', ')}`,
    )
  } else {
    log('every Published course has video attached ✔')
  }
  return drafted
}

/**
 * Replaces the marketing numbers invented for the demo with the truth.
 *
 * On a live site `rating` and `enrolledCount` are claims about the business made
 * to prospective buyers. Shipping the demo's invented values is a false
 * statement, so ratings go to zero (the UI hides a zero rating) and enrolment
 * counts are recomputed from actual Enrollment documents.
 */
export async function resetInventedStats() {
  const byCourse = await realEnrollmentCounts()

  const courses = await db.select().from(coursesTable)
  let changed = 0
  for (const c of courses) {
    const real = byCourse.get(String(c.id)) || 0
    const needs = c.rating !== 0 || c.enrolledCount !== real || c.enrolledLabel
    if (!needs) continue
    await db
      .update(coursesTable)
      .set({ rating: 0, enrolledCount: real, enrolledLabel: '' })
      .where(eq(coursesTable.id, c.id))
    changed += 1
  }
  log(`reset invented rating/enrolment figures on ${changed} course(s)`)
  return changed
}

/**
 * The operator mailbox. Password reset and every operational notification go
 * here, so it must be a real, monitored inbox — not an alias nobody reads.
 */
export const productionAdminEmail = () => cfg.adminEmail
