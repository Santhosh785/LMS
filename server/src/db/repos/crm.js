import { and, asc, count, desc, eq, gte, ilike, inArray, isNull, lte, or } from 'drizzle-orm'
import { db, withMongoId } from '../index.js'
import { isUuid } from '../coerce.js'
import {
  fitCallBookingNotes,
  fitCallBookings,
  flagshipApplicationNotes,
  flagshipApplications,
  leadNotes,
  leads,
  users,
} from '../schema/index.js'
import { findUserById } from './users.js'
import { HttpError } from '../../middleware/error.js'

/**
 * The three intake inboxes — mentor-popup leads, Flagship applications and fit
 * calls — as documents.
 *
 * Each was a Mongo document with an embedded `notes` array and an `owner`
 * reference the admin screens always populated. The notes are child tables now;
 * this module puts both back so the inbox screens, the CSV exports and the
 * tests see the shape they were written against: `owner: { _id, name, email }`
 * and `notes: [{ _id, body, author, authorName, at }]`.
 */
export const INBOXES = {
  lead: { table: leads, notes: leadNotes, fk: 'leadId' },
  application: {
    table: flagshipApplications,
    notes: flagshipApplicationNotes,
    fk: 'flagshipApplicationId',
  },
  fitCall: { table: fitCallBookings, notes: fitCallBookingNotes, fk: 'fitCallBookingId' },
}

const escapeLike = (q) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`

/**
 * The inbox filter: status, owner (or `unassigned`), a search box across
 * `searchFields`, and a received-between date range. `extra` holds further
 * column equalities (the leads inbox filters by source).
 */
export function inboxWhere(inbox, query, searchFields, extra = {}) {
  const { table } = INBOXES[inbox]
  const clauses = []
  if (query.status) clauses.push(eq(table.status, query.status))
  for (const [k, v] of Object.entries(extra)) if (v) clauses.push(eq(table[k], v))
  if (query.owner === 'unassigned') clauses.push(isNull(table.owner))
  else if (query.owner) {
    // An id that cannot exist matches nothing, as Mongo's cast-to-ObjectId did.
    clauses.push(isUuid(query.owner) ? eq(table.owner, query.owner) : isNull(table.id))
  }
  const q = query.q?.trim()
  if (q) clauses.push(or(...searchFields.map((f) => ilike(table[f], escapeLike(q)))))
  if (query.from) clauses.push(gte(table.createdAt, new Date(query.from)))
  if (query.to) clauses.push(lte(table.createdAt, new Date(`${query.to}T23:59:59.999Z`)))
  return clauses.length ? and(...clauses) : undefined
}

/** Rows → documents: owner populated, notes attached, `omit` keys dropped. */
async function hydrate(inbox, rows, { omit = [] } = {}) {
  if (!rows.length) return []
  const { notes, fk } = INBOXES[inbox]
  const ids = rows.map((r) => r.id)
  const ownerIds = [...new Set(rows.map((r) => r.owner).filter(Boolean))]

  const [noteRows, owners] = await Promise.all([
    db.select().from(notes).where(inArray(notes[fk], ids)).orderBy(asc(notes.at)),
    ownerIds.length
      ? db
          .select({ id: users.id, name: users.name, email: users.email })
          .from(users)
          .where(inArray(users.id, ownerIds))
      : [],
  ])
  const ownerById = new Map(owners.map((o) => [o.id, o]))

  return rows.map((row) => {
    const out = { ...row }
    for (const k of omit) delete out[k]
    out.owner = row.owner ? ownerById.get(row.owner) || null : null
    out.notes = noteRows
      .filter((n) => n[fk] === row.id)
      .map(({ id, body, author, authorName, at }) => ({ id, body, author, authorName, at }))
    return withMongoId(out)
  })
}

export async function listInbox(inbox, { where, limit, offset = 0, omit } = {}) {
  const { table } = INBOXES[inbox]
  let query = db.select().from(table).where(where).orderBy(desc(table.createdAt))
  if (limit) query = query.limit(limit).offset(offset)
  return hydrate(inbox, await query, { omit })
}

export async function countInbox(inbox, where) {
  const { table } = INBOXES[inbox]
  const [{ n }] = await db.select({ n: count() }).from(table).where(where)
  return n
}

/**
 * Per-status totals for the tab row. They ignore the status filter, or picking
 * one would zero the others and the tab row would stop being a summary.
 */
export async function statusCounts(inbox) {
  const { table } = INBOXES[inbox]
  const rows = await db
    .select({ status: table.status, n: count() })
    .from(table)
    .groupBy(table.status)
  return rows
}

export async function getInboxDoc(inbox, id) {
  if (!isUuid(id)) return null
  const { table } = INBOXES[inbox]
  const rows = await db.select().from(table).where(eq(table.id, id))
  return (await hydrate(inbox, rows))[0] || null
}

/** Raw row, for the read-modify-write in the PUT handlers. */
export async function getInboxRow(inbox, id) {
  if (!isUuid(id)) return null
  const { table } = INBOXES[inbox]
  const [row] = await db.select().from(table).where(eq(table.id, id))
  return row || null
}

export async function updateInbox(inbox, id, values) {
  const { table } = INBOXES[inbox]
  if (Object.keys(values).length) await db.update(table).set(values).where(eq(table.id, id))
  return getInboxDoc(inbox, id)
}

/** Appends a note; null when the record does not exist. */
export async function addNote(inbox, id, { body, author, authorName }) {
  if (!(await getInboxRow(inbox, id))) return null
  const { notes, fk } = INBOXES[inbox]
  await db.insert(notes).values({ [fk]: id, body, author, authorName })
  return getInboxDoc(inbox, id)
}

/** Assigning an owner is the same three lines on every inbox. */
export async function resolveOwner(owner) {
  if (!owner) return null
  const assignee = await findUserById(owner)
  if (!assignee) throw new HttpError(400, 'That owner does not exist')
  return assignee.id
}
