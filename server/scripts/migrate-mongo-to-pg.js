/**
 * One-shot ETL: MongoDB (read-only) → Supabase Postgres + Supabase Auth.
 *
 *   node scripts/migrate-mongo-to-pg.js [--force] [--report=<file.json>]
 *                                       [--verify-login=<email>]
 *
 * Reads MONGO_URI, writes DIRECT_DATABASE_URL (the session connection — the
 * transaction pooler cannot hold the one long session this needs). Mongo is
 * never written to: only find() and countDocuments() are issued against it.
 *
 * Identity: every Mongo ObjectId gets a fresh uuid, kept in the row's
 * `legacy_id`. One global ObjectId → uuid map (ObjectIds are unique across
 * collections) is built before anything is written, so every reference — a
 * column, an embedded array that becomes a child table, or an id buried inside
 * a jsonb blob — is remapped the same way. A reference to a document that does
 * not exist becomes NULL on a nullable column; on a NOT NULL one the row cannot
 * be migrated, is skipped, and counts as a mismatch.
 *
 * Users keep their passwords: each one becomes a Supabase Auth identity created
 * with the existing bcrypt hash (`password_hash`) and the profile row's uuid.
 *
 * Exit status: 0 only when the verification report has no mismatch. A lossy
 * conversion (a fractional value into an integer column, an enum value the
 * schema does not allow) is a mismatch too — a cutover must not proceed on data
 * that did not survive the move intact.
 *
 * Refuses a target that already holds data unless --force, which first deletes
 * the auth identities of previously migrated users and truncates every public
 * table. --force never deletes an identity that was not created by this script.
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import { MongoClient, ObjectId } from 'mongodb'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { getTableColumns } from 'drizzle-orm'
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core'
import { createClient } from '@supabase/supabase-js'
import { env } from '../src/config/env.js'
import * as T from '../src/db/schema/index.js'
import { describeTarget } from '../src/utils/dbTarget.js'

/* --------------------------------- args ---------------------------------- */

const args = process.argv.slice(2)
const flag = (name) => args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`))
const flagValue = (name) => flag(name)?.split('=').slice(1).join('=') || null
const FORCE = Boolean(flag('force'))
const REPORT_FILE = flagValue('report')
const VERIFY_LOGIN = flagValue('verify-login')

const log = (...a) => console.log('[etl]', ...a)
const fail = (...a) => console.error('[etl]', ...a)

if (!env.mongoUri) throw new Error('MONGO_URI is not set')
if (!env.directDatabaseUrl) throw new Error('DIRECT_DATABASE_URL is not set')
if (!env.supabase.url || !env.supabase.serviceRoleKey) {
  throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set')
}

/* ------------------------------ connections ------------------------------ */

const mongo = new MongoClient(env.mongoUri)
await mongo.connect()
const mdb = mongo.db()
const pgClient = new pg.Client({
  connectionString: env.directDatabaseUrl,
  ssl: { rejectUnauthorized: false },
})
await pgClient.connect()
await pgClient.query('set statement_timeout = 0')
const db = drizzle({ client: pgClient, casing: 'snake_case' })
const auth = createClient(env.supabase.url, env.supabase.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
}).auth.admin

log(`source: mongo database "${mdb.databaseName}"`)
log(`target: ${describeTarget(env.directDatabaseUrl)}`)

/* ------------------------------ the id map ------------------------------- */

/** hex ObjectId → uuid, across every collection and every embedded subdocument. */
const ids = new Map()
const isOid = (v) => v instanceof ObjectId || v?._bsontype === 'ObjectId'
const hex = (v) => (isOid(v) ? v.toHexString() : String(v))
const mint = (oid) => {
  const key = hex(oid)
  if (!ids.has(key)) ids.set(key, crypto.randomUUID())
  return ids.get(key)
}
/** The uuid for a reference, or null when it points at nothing that was migrated. */
const ref = (v) => (v == null ? null : (ids.get(hex(v)) ?? null))

/** Deep copy for jsonb: ObjectIds become their uuid (or hex if unknown). */
function plain(v) {
  if (v == null) return v
  if (isOid(v)) return ids.get(hex(v)) ?? hex(v)
  if (v instanceof Date) return v.toISOString()
  if (Array.isArray(v)) return v.map(plain)
  if (typeof v === 'object') {
    const out = {}
    for (const [k, val] of Object.entries(v)) {
      if (k === '__v') continue
      out[k === '_id' ? '_id' : k] = plain(val)
    }
    return out
  }
  return v
}

/* ------------------------------ diagnostics ------------------------------ */

const issues = [] // anything here makes the run fail
const notes = [] // informational
const issue = (msg) => {
  issues.push(msg)
  fail('MISMATCH', msg)
}

/* --------------------------- generic row builder ------------------------- */

/**
 * Mongo document → column values for `table`, by matching field names (the
 * schema uses the Mongo field names, snake_cased only in SQL). `extra` wins over
 * anything taken from the document. Returns null when a NOT NULL reference
 * cannot be resolved, so the caller skips the row.
 */
function row(table, doc, extra = {}, label = getTableConfig(table).name) {
  const cols = getTableColumns(table)
  const out = {}
  for (const [key, col] of Object.entries(cols)) {
    if (key in extra) {
      out[key] = extra[key]
      continue
    }
    if (key === 'id') continue
    if (key === 'legacyId') {
      if (doc._id != null) out.legacyId = hex(doc._id)
      continue
    }
    let v = doc[key]
    if (v === undefined) continue
    if (v === null) {
      if (!col.notNull) out[key] = null
      continue
    }
    switch (col.columnType) {
      case 'PgUUID': {
        const mapped = ref(v)
        if (!mapped) {
          if (col.notNull) {
            issue(`${label} ${hex(doc._id)}: ${key} → ${hex(v)} does not exist; row skipped`)
            return null
          }
          notes.push(`${label} ${hex(doc._id)}: dangling ${key} → ${hex(v)} set to NULL`)
          v = null
        } else v = mapped
        break
      }
      case 'PgInteger':
      case 'PgBigInt53': {
        const n = Number(v)
        if (!Number.isFinite(n)) continue
        if (!Number.isInteger(n)) {
          issue(`${label} ${hex(doc._id)}: ${key}=${n} is fractional but the column is integer`)
          v = Math.round(n)
        } else v = n
        break
      }
      case 'PgDoublePrecision':
      case 'PgNumericNumber':
        v = Number(v)
        if (!Number.isFinite(v)) continue
        break
      case 'PgTimestamp':
        v = v instanceof Date ? v : new Date(v)
        if (Number.isNaN(v.getTime())) continue
        break
      case 'PgArray':
        v = (Array.isArray(v) ? v : [v]).filter((x) => x != null).map((x) => String(plain(x)))
        break
      case 'PgJsonb':
        v = plain(v)
        break
      case 'PgBoolean':
        v = Boolean(v)
        break
      case 'PgText':
        if (isOid(v)) v = hex(v)
        else if (typeof v === 'object') v = JSON.stringify(plain(v))
        else v = String(v)
        if (col.enumValues?.length && !col.enumValues.includes(v)) {
          issue(`${label} ${hex(doc._id)}: ${key}="${v}" is not one of ${col.enumValues.join('|')}`)
          if (col.hasDefault) continue
          return null
        }
        break
      default:
        break
    }
    out[key] = v
  }
  return out
}

/* ------------------------------ write helpers ---------------------------- */

const written = {} // table name → rows inserted
const bump = (table, n) => {
  const name = getTableConfig(table).name
  written[name] = (written[name] || 0) + n
}

async function insert(table, rows) {
  const list = rows.filter(Boolean)
  for (let i = 0; i < list.length; i += 500) {
    const chunk = list.slice(i, i + 500)
    await db.insert(table).values(chunk)
  }
  bump(table, list.length)
}

const docsOf = (collection) => mdb.collection(collection).find({}).toArray()

/* ------------------------------ target check ----------------------------- */

const ALL_TABLES = Object.values(T).filter((v) => v instanceof PgTable)
const tableList = ALL_TABLES.map((t) => `"${getTableConfig(t).name}"`).join(', ')

async function targetRowCount() {
  const parts = ALL_TABLES.map((t) => `(select count(*) from "${getTableConfig(t).name}")`)
  const { rows } = await pgClient.query(`select ${parts.join(' + ')} as n`)
  return Number(rows[0].n)
}

const existing = await targetRowCount()
if (existing > 0 && !FORCE) {
  fail(`target already holds ${existing} row(s). Nothing was written.`)
  fail('Re-run with --force to delete previously migrated users and truncate every table first.')
  await mongo.close()
  await pgClient.end()
  process.exit(1)
}
if (existing > 0) {
  log(`--force: clearing ${existing} existing row(s)`)
  // Only identities this script created (their profile carries a legacy_id).
  await pgClient.query(
    `delete from auth.users where id in (select id from users where legacy_id is not null)`,
  )
  await pgClient.query(`truncate ${tableList} restart identity cascade`)
}

// A row nothing else writes: if it is gone by the end, something truncated the
// target mid-run and the report below would be describing someone else's data.
const CANARY = `etl-canary-${crypto.randomUUID()}`

/* --------------------------- load + mint ids ----------------------------- */

const COLLECTIONS = {
  users: 'users',
  courses: 'courses',
  enrollments: 'enrollments',
  transactions: 'transactions',
  customers: 'customers',
  counters: 'counters',
  certificates: 'certificates',
  practiceItems: 'practiceitems',
  channels: 'channels',
  posts: 'posts',
  comments: 'comments',
  reports: 'reports',
  blocks: 'blocks',
  liveClasses: 'liveclasses',
  bookings: 'bookings',
  liveBookings: 'livebookings',
  workshops: 'workshops',
  workshopRegistrations: 'workshopregistrations',
  leads: 'leads',
  fitCallBookings: 'fitcallbookings',
  flagshipApplications: 'flagshipapplications',
  emailLists: 'emaillists',
  emailContacts: 'emailcontacts',
  broadcasts: 'broadcasts',
  funnels: 'funnels',
  funnelSteps: 'funnelsteps',
  funnelLeads: 'funnelleads',
  badges: 'badges',
  pointRules: 'pointrules',
  leaderboardEntries: 'leaderboardentries',
  media: 'media',
  blogPosts: 'blogposts',
  blogComments: 'blogcomments',
  terms: 'terms',
  playbooks: 'playbooks',
  claudeSkills: 'claudeskills',
  programs: 'programs',
  settings: 'settings',
}

const known = new Set(
  await mdb
    .listCollections()
    .map((c) => c.name)
    .toArray(),
)
for (const name of known) {
  if (!Object.values(COLLECTIONS).includes(name)) {
    issue(`mongo collection "${name}" has no mapping — its documents would be left behind`)
  }
}

const D = {}
for (const [key, name] of Object.entries(COLLECTIONS)) {
  D[key] = known.has(name) ? await docsOf(name) : []
}
for (const [key, docs] of Object.entries(D)) {
  if (key === 'counters') continue
  for (const d of docs) mint(d._id)
}
// Embedded subdocuments that become rows, minted up front so anything pointing
// at them (enrollment progress, drip rules) resolves.
for (const c of D.courses) {
  for (const s of c.sections || []) {
    mint(s._id)
    for (const l of s.lessons || []) mint(l._id)
  }
  for (const p of c.pricingPlans || []) mint(p._id)
}
log(
  `loaded ${Object.values(D).reduce((n, d) => n + d.length, 0)} documents, minted ${ids.size} ids`,
)

/* -------------------------------- users ---------------------------------- */

log('users → Supabase Auth + profiles…')
const userRows = []
let authCreated = 0
for (const u of D.users) {
  const id = ids.get(hex(u._id))
  const email = String(u.email || '')
    .trim()
    .toLowerCase()
  const { error } = await auth.createUser({
    id,
    email,
    email_confirm: true,
    ...(u.passwordHash ? { password_hash: u.passwordHash } : {}),
  })
  if (error) {
    issue(`user ${email}: Supabase createUser failed — ${error.message}`)
    continue
  }
  authCreated += 1
  userRows.push(row(T.users, { ...u, email }, { id }))
}
await insert(T.users, userRows)

/* -------------------------------- courses -------------------------------- */

log('courses, curriculum, pricing plans…')
const sectionRows = []
const lessonRows = []
const planRows = []
const courseRows = D.courses.map((c) => {
  const courseId = ids.get(hex(c._id))
  ;(c.sections || []).forEach((s, si) => {
    const sectionId = ids.get(hex(s._id))
    sectionRows.push(row(T.courseSections, s, { id: sectionId, courseId, order: s.order ?? si }))
    ;(s.lessons || []).forEach((l, li) => {
      lessonRows.push(
        row(T.lessons, l, { id: ids.get(hex(l._id)), sectionId, courseId, order: l.order ?? li }),
      )
    })
  })
  ;(c.pricingPlans || []).forEach((p, pi) => {
    planRows.push(row(T.coursePricingPlans, p, { id: ids.get(hex(p._id)), courseId, order: pi }))
  })
  return row(T.courses, c, { id: courseId })
})
await insert(T.courses, courseRows)
await insert(T.courseSections, sectionRows)
await insert(T.lessons, lessonRows)
await insert(T.coursePricingPlans, planRows)

/* ------------------------------- commerce -------------------------------- */

log('customers, transactions, counters…')
await insert(
  T.customers,
  D.customers.map((d) => row(T.customers, d, { id: ids.get(hex(d._id)) })),
)
await insert(
  T.transactions,
  D.transactions.map((t) =>
    row(T.transactions, t, {
      id: ids.get(hex(t._id)),
      buyerName: t.buyer?.name ?? null,
      buyerEmail: t.buyer?.email ? String(t.buyer.email).trim().toLowerCase() : null,
      buyerPhone: t.buyer?.phone ?? null,
    }),
  ),
)

/*
 * The invoice counter must start past every number already issued, not just at
 * the Mongo counter: an imported or hand-entered invoice above the counter would
 * otherwise be minted again, and invoice_no is unique — the next fulfilment
 * would fail. The series is global (the year is only a label), so the highest
 * trailing sequence across all invoices is the floor.
 */
const issuedMax = D.transactions.reduce((m, t) => {
  const n = Number(/(\d+)$/.exec(t.invoiceNo || '')?.[1] || 0)
  return Math.max(m, n)
}, 0)
for (const c of D.counters) {
  const seq = c._id === 'invoice' ? Math.max(Number(c.seq) || 0, issuedMax) : Number(c.seq) || 0
  if (c._id === 'invoice' && seq !== Number(c.seq)) {
    notes.push(`invoice counter raised from ${c.seq} to ${seq} — the highest issued number`)
  }
  await db.insert(T.counters).values({ key: String(c._id), seq })
  bump(T.counters, 1)
}
if (!D.counters.some((c) => c._id === 'invoice') && issuedMax) {
  await db.insert(T.counters).values({ key: 'invoice', seq: issuedMax })
  bump(T.counters, 1)
  notes.push(`no Mongo invoice counter; seeded from the highest issued number ${issuedMax}`)
}

/* ------------------------------- learning -------------------------------- */

log('enrollments, certificates, practice…')
const completedRows = []
const enrollmentRows = []
for (const e of D.enrollments) {
  const id = ids.get(hex(e._id))
  const r = row(T.enrollments, e, { id })
  if (!r) continue
  enrollmentRows.push(r)
  const seen = new Set()
  for (const l of e.completedLessonIds || []) {
    const lessonId = ref(l)
    if (!lessonId) {
      notes.push(`enrollment ${hex(e._id)}: completed lesson ${hex(l)} no longer exists — dropped`)
      continue
    }
    if (seen.has(lessonId)) continue
    seen.add(lessonId)
    completedRows.push({ enrollmentId: id, lessonId })
  }
}
await insert(T.enrollments, enrollmentRows)
await insert(T.enrollmentCompletedLessons, completedRows)

await insert(
  T.certificates,
  D.certificates.map((d) => row(T.certificates, d, { id: ids.get(hex(d._id)) })),
)

const attemptRows = []
const practiceRows = D.practiceItems.map((p) => {
  const id = ids.get(hex(p._id))
  for (const a of p.attempts || []) {
    attemptRows.push(row(T.practiceAttempts, { ...a, _id: undefined }, { practiceItemId: id }))
  }
  return row(T.practiceItems, p, { id })
})
await insert(T.practiceItems, practiceRows)
await insert(T.practiceAttempts, attemptRows)

/* ------------------------------- community ------------------------------- */

log('channels, posts, comments, moderation…')
const memberRows = []
const channelRows = D.channels.map((c) => {
  const id = ids.get(hex(c._id))
  for (const userId of new Set((c.memberIds || []).map(ref).filter(Boolean))) {
    memberRows.push({ channelId: id, userId })
  }
  return row(T.channels, c, { id })
})
await insert(T.channels, channelRows)
await insert(T.channelMembers, memberRows)

const likeRows = []
const postRows = []
for (const p of D.posts) {
  const id = ids.get(hex(p._id))
  const r = row(T.posts, p, { id })
  if (!r) continue
  postRows.push(r)
  for (const userId of new Set((p.likes || []).map(ref).filter(Boolean))) {
    likeRows.push({ postId: id, userId })
  }
}
await insert(T.posts, postRows)
await insert(T.postLikes, likeRows)
await insert(
  T.comments,
  D.comments.map((d) => row(T.comments, d, { id: ids.get(hex(d._id)) })),
)
await insert(
  T.reports,
  D.reports.map((d) =>
    // targetId is polymorphic and FK-free; keep the uuid if the target migrated.
    row(T.reports, d, {
      id: ids.get(hex(d._id)),
      targetId: ref(d.targetId) ?? crypto.randomUUID(),
    }),
  ),
)
await insert(
  T.blocks,
  D.blocks.map((d) => row(T.blocks, d, { id: ids.get(hex(d._id)) })),
)

/* ---------------------------------- live --------------------------------- */

log('live classes, bookings, workshops…')
const attendeeRows = []
const liveRows = D.liveClasses.map((l) => {
  const id = ids.get(hex(l._id))
  for (const userId of new Set((l.attendees || []).map(ref).filter(Boolean))) {
    attendeeRows.push({ liveClassId: id, userId })
  }
  return row(T.liveClasses, l, { id })
})
await insert(T.liveClasses, liveRows)
await insert(T.liveClassAttendees, attendeeRows)
await insert(
  T.bookings,
  D.bookings.map((d) => row(T.bookings, d, { id: ids.get(hex(d._id)) })),
)
await insert(
  T.liveBookings,
  D.liveBookings.map((d) => row(T.liveBookings, d, { id: ids.get(hex(d._id)) })),
)
await insert(
  T.workshops,
  D.workshops.map((d) => row(T.workshops, d, { id: ids.get(hex(d._id)) })),
)
await insert(
  T.workshopRegistrations,
  D.workshopRegistrations.map((d) =>
    row(T.workshopRegistrations, d, {
      id: ids.get(hex(d._id)),
      guestName: d.guest?.name ?? null,
      guestEmail: d.guest?.email ? String(d.guest.email).trim().toLowerCase() : null,
      guestPhone: d.guest?.phone ?? null,
    }),
  ),
)

/* ---------------------------------- crm ---------------------------------- */

log('leads, fit calls, applications…')
async function withNotes(parentTable, noteTable, fk, docs) {
  const noteRows = []
  const parents = docs.map((d) => {
    const id = ids.get(hex(d._id))
    for (const n of d.notes || []) {
      noteRows.push(row(noteTable, { ...n, _id: undefined }, { [fk]: id }))
    }
    return row(parentTable, d, { id })
  })
  await insert(parentTable, parents)
  await insert(noteTable, noteRows)
}
await withNotes(T.leads, T.leadNotes, 'leadId', D.leads)
await withNotes(T.fitCallBookings, T.fitCallBookingNotes, 'fitCallBookingId', D.fitCallBookings)
await withNotes(
  T.flagshipApplications,
  T.flagshipApplicationNotes,
  'flagshipApplicationId',
  D.flagshipApplications,
)

/* ------------------------------- marketing ------------------------------- */

log('email, funnels, gamification…')
await insert(
  T.emailLists,
  D.emailLists.map((d) => row(T.emailLists, d, { id: ids.get(hex(d._id)) })),
)
const contactListRows = []
const contactRows = D.emailContacts.map((c) => {
  const id = ids.get(hex(c._id))
  for (const listId of new Set((c.listIds || []).map(ref).filter(Boolean))) {
    contactListRows.push({ contactId: id, listId })
  }
  return row(T.emailContacts, c, { id })
})
await insert(T.emailContacts, contactRows)
await insert(T.emailContactLists, contactListRows)
await insert(
  T.broadcasts,
  D.broadcasts.map((d) => row(T.broadcasts, d, { id: ids.get(hex(d._id)) })),
)
await insert(
  T.funnels,
  D.funnels.map((d) => row(T.funnels, d, { id: ids.get(hex(d._id)) })),
)
await insert(
  T.funnelSteps,
  D.funnelSteps.map((d) => row(T.funnelSteps, d, { id: ids.get(hex(d._id)) })),
)
await insert(
  T.funnelLeads,
  D.funnelLeads.map((d) => row(T.funnelLeads, d, { id: ids.get(hex(d._id)) })),
)
for (const [key, table] of [
  ['badges', T.badges],
  ['pointRules', T.pointRules],
  ['leaderboardEntries', T.leaderboardEntries],
]) {
  await insert(
    table,
    D[key].map((d) => row(table, d, { id: ids.get(hex(d._id)) })),
  )
}

/* -------------------------------- content -------------------------------- */

log('media, blog, taxonomy, resources, programs, settings…')
/*
 * Blog posts. Two things the Mongo era tolerated that Postgres will not:
 * every revision needs an `_id` (the restore endpoint looks revisions up by it;
 * the Mongo subdocument id is kept as a string, a missing one gets a uuid), and
 * a post with no status/visibility was treated as public by the old blog, so it
 * is written as Published/Public rather than silently becoming a Draft.
 */
// Media first: blog posts reference it (image_media_id has a foreign key).
await insert(
  T.media,
  D.media.map((d) => row(T.media, d, { id: ids.get(hex(d._id)) })),
)

let blogDefaulted = 0
await insert(
  T.blogPosts,
  D.blogPosts.map((p) => {
    if (!p.status || !p.visibility) blogDefaulted += 1
    const revisions = (p.revisions || []).map((r) => ({
      ...plain(r),
      _id: r._id ? hex(r._id) : crypto.randomUUID(),
    }))
    return row(T.blogPosts, p, {
      id: ids.get(hex(p._id)),
      status: p.status || 'Published',
      visibility: p.visibility || 'Public',
      revisions,
    })
  }),
)
if (blogDefaulted) {
  notes.push(`${blogDefaulted} blog post(s) had no status/visibility — written as Published/Public`)
}

for (const [key, table] of [
  ['blogComments', T.blogComments],
  ['terms', T.terms],
  ['playbooks', T.playbooks],
  ['claudeSkills', T.claudeSkills],
  ['programs', T.programs],
  ['settings', T.settings],
]) {
  await insert(
    table,
    D[key].map((d) => row(table, d, { id: ids.get(hex(d._id)) })),
  )
}

await db.insert(T.counters).values({ key: CANARY, seq: 1 })

/* ------------------------------ verification ----------------------------- */

log('verifying…')
const q = async (text, params) => (await pgClient.query(text, params)).rows

const canary = await q('select 1 from counters where key = $1', [CANARY])
if (!canary.length) {
  issue('the canary row vanished — something else truncated the target during the run')
}
await pgClient.query('delete from counters where key = $1', [CANARY])

const report = { collections: [], children: [], totals: {}, issues, notes }

// 1. One row per document, per collection.
for (const [key, name] of Object.entries(COLLECTIONS)) {
  if (key === 'counters') continue
  const table = T[key]
  const tname = getTableConfig(table).name
  const mongoCount = known.has(name) ? await mdb.collection(name).countDocuments() : 0
  const [{ n }] = await q(`select count(*)::int n from "${tname}"`)
  const ok = mongoCount === n
  report.collections.push({ collection: name, table: tname, mongo: mongoCount, postgres: n, ok })
  if (!ok) issue(`${name}: ${mongoCount} documents in Mongo, ${n} rows in ${tname}`)
}

// 2. Embedded arrays → child tables.
const sumLen = (docs, f) => docs.reduce((s, d) => s + (f(d) || []).length, 0)
const distinctLen = (docs, f) =>
  docs.reduce((s, d) => s + new Set((f(d) || []).map((v) => ref(v)).filter(Boolean)).size, 0)
const children = [
  ['course_sections', sumLen(D.courses, (c) => c.sections)],
  ['lessons', D.courses.reduce((s, c) => s + sumLen(c.sections || [], (x) => x.lessons), 0)],
  ['course_pricing_plans', sumLen(D.courses, (c) => c.pricingPlans)],
  ['enrollment_completed_lessons', distinctLen(D.enrollments, (e) => e.completedLessonIds)],
  ['channel_members', distinctLen(D.channels, (c) => c.memberIds)],
  ['post_likes', distinctLen(D.posts, (p) => p.likes)],
  ['live_class_attendees', distinctLen(D.liveClasses, (l) => l.attendees)],
  ['email_contact_lists', distinctLen(D.emailContacts, (c) => c.listIds)],
  ['practice_attempts', sumLen(D.practiceItems, (p) => p.attempts)],
  ['lead_notes', sumLen(D.leads, (d) => d.notes)],
  ['fit_call_booking_notes', sumLen(D.fitCallBookings, (d) => d.notes)],
  ['flagship_application_notes', sumLen(D.flagshipApplications, (d) => d.notes)],
]
for (const [tname, expected] of children) {
  const [{ n }] = await q(`select count(*)::int n from "${tname}"`)
  const ok = expected === n
  report.children.push({ table: tname, expected, postgres: n, ok })
  if (!ok) issue(`${tname}: expected ${expected} rows from embedded arrays, found ${n}`)
}

// 3. Money.
const mongoPaid = D.transactions
  .filter((t) => t.status === 'SUCCESS')
  .reduce((s, t) => s + Number(t.amount || 0), 0)
const [{ paid }] = await q(
  `select coalesce(sum(amount), 0)::float8 paid from transactions where status = 'SUCCESS'`,
)
report.totals.successAmount = { mongo: mongoPaid, postgres: paid, ok: mongoPaid === paid }
if (mongoPaid !== paid) issue(`SUCCESS amount: Mongo ₹${mongoPaid}, Postgres ₹${paid}`)

const mongoRefunded = D.transactions.reduce((s, t) => s + Number(t.refundedAmount || 0), 0)
const [{ refunded }] = await q(
  `select coalesce(sum(refunded_amount), 0)::float8 refunded from transactions`,
)
report.totals.refundedAmount = { mongo: mongoRefunded, postgres: refunded }
if (mongoRefunded !== refunded) issue(`refunded: Mongo ₹${mongoRefunded}, Postgres ₹${refunded}`)

// 4. Enrollments per course.
const mongoPerCourse = {}
for (const e of D.enrollments) {
  const k = hex(e.courseId)
  mongoPerCourse[k] = (mongoPerCourse[k] || 0) + 1
}
const pgPerCourse = Object.fromEntries(
  (
    await q(
      `select c.legacy_id k, count(*)::int n from enrollments e join courses c on c.id = e.course_id group by c.legacy_id`,
    )
  ).map((r) => [r.k, r.n]),
)
const courseMismatch = Object.keys({ ...mongoPerCourse, ...pgPerCourse }).filter(
  (k) => (mongoPerCourse[k] || 0) !== (pgPerCourse[k] || 0),
)
report.totals.enrollmentsPerCourse = {
  courses: Object.keys(mongoPerCourse).length,
  ok: courseMismatch.length === 0,
}
for (const k of courseMismatch) {
  issue(`course ${k}: ${mongoPerCourse[k] || 0} enrollments in Mongo, ${pgPerCourse[k] || 0} here`)
}

// 5. Invoice numbers.
const mongoMaxInvoice = D.transactions
  .map((t) => t.invoiceNo)
  .filter(Boolean)
  .sort()
  .at(-1)
const [{ maxinv }] = await q(`select max(invoice_no) maxinv from transactions`)
const [counterRow] = await q(`select seq from counters where key = 'invoice'`)
report.totals.invoices = {
  mongoMax: mongoMaxInvoice || null,
  postgresMax: maxinv || null,
  counterSeq: counterRow ? Number(counterRow.seq) : null,
  highestIssuedSeq: issuedMax,
  ok:
    (mongoMaxInvoice || null) === (maxinv || null) &&
    (!issuedMax || Number(counterRow?.seq) >= issuedMax),
}
if (!report.totals.invoices.ok) issue('invoice numbers or counter do not line up')

// 6. Identities.
const [{ authn }] = await q(
  `select count(*)::int authn from auth.users where id in (select id from users where legacy_id is not null)`,
)
report.totals.authUsers = { mongoUsers: D.users.length, created: authCreated, inAuth: authn }
if (authn !== D.users.length)
  issue(`auth identities: ${D.users.length} Mongo users, ${authn} in auth.users`)

// 7. Optional: prove an old password still works.
if (VERIFY_LOGIN) {
  const password = process.env.ETL_VERIFY_PASSWORD || env.seedPassword
  const client = createClient(env.supabase.url, env.supabase.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await client.auth.signInWithPassword({ email: VERIFY_LOGIN, password })
  const ok = !error && Boolean(data?.session)
  report.totals.verifyLogin = { email: VERIFY_LOGIN, ok, error: error?.message }
  if (!ok) issue(`sign-in as ${VERIFY_LOGIN} with the old password failed: ${error?.message}`)
}

/* -------------------------------- output --------------------------------- */

const pad = (s, n) => String(s).padEnd(n)
console.log('\n=== ETL verification report ===')
console.log(pad('collection', 24), pad('table', 30), pad('mongo', 7), pad('pg', 7), 'ok')
for (const r of report.collections) {
  console.log(
    pad(r.collection, 24),
    pad(r.table, 30),
    pad(r.mongo, 7),
    pad(r.postgres, 7),
    r.ok ? '✔' : '✘',
  )
}
console.log('\nembedded → child tables')
for (const r of report.children) {
  console.log(
    pad(r.table, 30),
    pad(`expected ${r.expected}`, 14),
    pad(`pg ${r.postgres}`, 8),
    r.ok ? '✔' : '✘',
  )
}
console.log('\ntotals', JSON.stringify(report.totals, null, 2))
if (notes.length) {
  console.log(`\nnotes (${notes.length}):`)
  for (const n of notes) console.log('  -', n)
}
if (REPORT_FILE) fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2))

await mongo.close()
await pgClient.end()

if (issues.length) {
  fail(`\n${issues.length} mismatch(es) — do NOT cut over on this run:`)
  for (const i of issues) fail('  •', i)
  process.exit(1)
}
log('\nverification clean ✔')
