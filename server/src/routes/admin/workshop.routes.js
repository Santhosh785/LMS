import { Router } from 'express'
import { asyncHandler, HttpError } from '../../middleware/error.js'
import { and, count, desc, eq, gt, sql } from 'drizzle-orm'
import { db, withMongoId } from '../../db/index.js'
import { isUuid } from '../../db/coerce.js'
import { users, workshopRegistrations, workshops } from '../../db/schema/index.js'
import { registrationDoc } from '../../db/repos/workshops.js'
import { pickColumns } from '../../db/repos/content.js'
import { crudRouter } from '../../utils/crudRouter.js'
import { sendCsv } from '../../utils/csv.js'
import { safeContentChanged } from '../../services/contentEvents.js'

const router = Router()

/** Sitemap + edge purge for a workshop page, under its old slug too on a rename. */
const workshopChanged = (...slugs) =>
  safeContentChanged({ kind: 'workshop', slugs: [...new Set(slugs.filter(Boolean))] })

/**
 * Workshops and, more importantly, who registered for them.
 *
 * `POST /api/workshops/:id/register` has been writing registrations that no
 * admin route could read — people were signing up invisibly. This exposes the
 * list, attendance marking and a CSV for whoever runs the session.
 */

/** A registration is either a signed-in user or a guest; flatten both. */
const attendee = (r) => ({
  _id: r._id,
  name: r.userId?.name || r.guest?.name || '—',
  email: r.userId?.email || r.guest?.email || '',
  phone: r.userId?.phone || r.guest?.phone || '',
  kind: r.userId ? 'account' : 'guest',
  attended: Boolean(r.attended),
  waitlisted: Boolean(r.waitlisted),
  cancelledAt: r.cancelledAt || null,
  note: r.note || '',
  registeredAt: r.createdAt,
})

/**
 * Registrations joined to their account and workshop — the Mongo version's two
 * `populate`s. `userId` and `workshopId` come back as the populated objects
 * (or null), the shape `attendee()` and the admin screen read.
 */
async function loadRegistrations(where, { limit, workshopFields }) {
  const query = db
    .select({
      registration: workshopRegistrations,
      user: pickColumns(users, 'name email phone'),
      workshop: pickColumns(workshops, workshopFields),
    })
    .from(workshopRegistrations)
    .leftJoin(users, eq(users.id, workshopRegistrations.userId))
    .leftJoin(workshops, eq(workshops.id, workshopRegistrations.workshopId))
    .where(where)
    .orderBy(desc(workshopRegistrations.createdAt))
  const rows = limit ? await query.limit(limit) : await query
  return rows.map(({ registration, user, workshop }) => ({
    ...registrationDoc(registration),
    userId: user?.id ? withMongoId(user) : null,
    workshopId: workshop?.id ? withMongoId(workshop) : null,
  }))
}

const byWorkshop = (id) =>
  id && isUuid(String(id)) ? eq(workshopRegistrations.workshopId, String(id)) : undefined

router.get(
  '/registrations',
  asyncHandler(async (req, res) => {
    // An unparseable workshop id matches nothing, as a Mongo cast would.
    if (req.query.workshopId && !isUuid(String(req.query.workshopId))) {
      return res.json({ items: [], total: 0 })
    }
    const clauses = [byWorkshop(req.query.workshopId)]
    if (req.query.attended === 'true') clauses.push(eq(workshopRegistrations.attended, true))
    if (req.query.attended === 'false') clauses.push(eq(workshopRegistrations.attended, false))

    const rows = await loadRegistrations(and(...clauses), {
      limit: Math.min(Number(req.query.limit) || 500, 1000),
      workshopFields: 'title slug startsAt capacity registeredCount mode venue',
    })

    res.json({
      items: rows.map((r) => ({ ...attendee(r), workshop: r.workshopId })),
      total: rows.length,
    })
  }),
)

router.get(
  '/registrations/export',
  asyncHandler(async (req, res) => {
    const rows =
      req.query.workshopId && !isUuid(String(req.query.workshopId))
        ? []
        : await loadRegistrations(byWorkshop(req.query.workshopId), { workshopFields: 'title' })

    sendCsv(
      res,
      'workshop-registrations.csv',
      rows.map((r) => ({ ...attendee(r), workshop: r.workshopId?.title || '' })),
      [
        { key: 'workshop', label: 'Workshop' },
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'phone', label: 'Phone' },
        { key: 'kind', label: 'Type' },
        { key: 'attended', label: 'Attended', get: (r) => (r.attended ? 'yes' : 'no') },
        { key: 'waitlisted', label: 'Waitlisted', get: (r) => (r.waitlisted ? 'yes' : 'no') },
        { key: 'registeredAt', label: 'Registered', get: (r) => r.registeredAt?.toISOString() },
        { key: 'note', label: 'Note' },
      ],
    )
  }),
)

/** Attendance and per-registration notes. */
router.put(
  '/registrations/:id',
  asyncHandler(async (req, res) => {
    const patch = {}
    if (req.body.attended !== undefined) patch.attended = Boolean(req.body.attended)
    if (req.body.note !== undefined) patch.note = req.body.note
    if (req.body.waitlisted !== undefined) patch.waitlisted = Boolean(req.body.waitlisted)

    if (!isUuid(req.params.id)) throw new HttpError(404, 'Registration not found')
    const [row] = Object.keys(patch).length
      ? await db
          .update(workshopRegistrations)
          .set(patch)
          .where(eq(workshopRegistrations.id, req.params.id))
          .returning({ id: workshopRegistrations.id })
      : await db
          .select({ id: workshopRegistrations.id })
          .from(workshopRegistrations)
          .where(eq(workshopRegistrations.id, req.params.id))
    if (!row) throw new HttpError(404, 'Registration not found')
    res.json({ ok: true })
  }),
)

/**
 * Removing a registration frees the seat, so `registeredCount` has to come down
 * with it — the public workshop page shows seats remaining from that counter.
 */
router.delete(
  '/registrations/:id',
  asyncHandler(async (req, res) => {
    if (!isUuid(req.params.id)) throw new HttpError(404, 'Registration not found')
    const removed = await db.transaction(async (tx) => {
      const [row] = await tx
        .delete(workshopRegistrations)
        .where(eq(workshopRegistrations.id, req.params.id))
        .returning({ workshopId: workshopRegistrations.workshopId })
      if (!row) return false
      const [workshop] = await tx
        .update(workshops)
        .set({ registeredCount: sql`${workshops.registeredCount} - 1` })
        .where(and(eq(workshops.id, row.workshopId), gt(workshops.registeredCount, 0)))
        .returning({ slug: workshops.slug })
      return { slug: workshop?.slug }
    })
    if (!removed) throw new HttpError(404, 'Registration not found')
    // The public page shows seats remaining from the counter that just moved.
    if (removed.slug) await workshopChanged(removed.slug)
    res.json({ ok: true })
  }),
)

/** Per-workshop rollup for the list screen. */
router.get(
  '/summary',
  asyncHandler(async (_req, res) => {
    const [list, grouped] = await Promise.all([
      db
        .select()
        .from(workshops)
        .orderBy(sql`${workshops.startsAt} desc nulls last`),
      db
        .select({
          workshopId: workshopRegistrations.workshopId,
          registered: count(),
          attended: sql`count(*) filter (where ${workshopRegistrations.attended})`.mapWith(Number),
        })
        .from(workshopRegistrations)
        .groupBy(workshopRegistrations.workshopId),
    ])

    const byId = Object.fromEntries(grouped.map((g) => [String(g.workshopId), g]))
    res.json({
      items: withMongoId(list).map((w) => ({
        ...w,
        registered: byId[String(w._id)]?.registered || 0,
        attended: byId[String(w._id)]?.attended || 0,
        seatsLeft: Math.max(0, (w.capacity || 0) - (byId[String(w._id)]?.registered || 0)),
      })),
    })
  }),
)

router.use(
  '/',
  crudRouter(workshops, {
    name: 'Workshop',
    searchFields: ['title', 'slug'],
    sort: { startsAt: -1 },
    onChange: (_kind, row, previous) => workshopChanged(row.slug, previous?.slug),
  }),
)

export default router
