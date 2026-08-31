import { Router } from 'express'
import { asyncHandler, HttpError } from '../../middleware/error.js'
import { Workshop, WorkshopRegistration } from '../../models/index.js'
import { crudRouter } from '../../utils/crudRouter.js'
import { sendCsv } from '../../utils/csv.js'

const router = Router()

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

router.get(
  '/registrations',
  asyncHandler(async (req, res) => {
    const filter = {}
    if (req.query.workshopId) filter.workshopId = req.query.workshopId
    if (req.query.attended === 'true') filter.attended = true
    if (req.query.attended === 'false') filter.attended = false

    const rows = await WorkshopRegistration.find(filter)
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(req.query.limit) || 500, 1000))
      .populate('userId', 'name email phone')
      .populate('workshopId', 'title slug startsAt capacity registeredCount mode venue')
      .lean()

    res.json({
      items: rows.map((r) => ({ ...attendee(r), workshop: r.workshopId })),
      total: rows.length,
    })
  }),
)

router.get(
  '/registrations/export',
  asyncHandler(async (req, res) => {
    const filter = req.query.workshopId ? { workshopId: req.query.workshopId } : {}
    const rows = await WorkshopRegistration.find(filter)
      .sort({ createdAt: -1 })
      .populate('userId', 'name email phone')
      .populate('workshopId', 'title')
      .lean()

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

    const row = await WorkshopRegistration.findByIdAndUpdate(req.params.id, patch, { new: true })
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
    const row = await WorkshopRegistration.findByIdAndDelete(req.params.id)
    if (!row) throw new HttpError(404, 'Registration not found')
    await Workshop.updateOne(
      { _id: row.workshopId, registeredCount: { $gt: 0 } },
      { $inc: { registeredCount: -1 } },
    )
    res.json({ ok: true })
  }),
)

/** Per-workshop rollup for the list screen. */
router.get(
  '/summary',
  asyncHandler(async (_req, res) => {
    const [workshops, grouped] = await Promise.all([
      Workshop.find().sort({ startsAt: -1 }).lean(),
      WorkshopRegistration.aggregate([
        {
          $group: {
            _id: '$workshopId',
            registered: { $sum: 1 },
            attended: { $sum: { $cond: ['$attended', 1, 0] } },
          },
        },
      ]),
    ])

    const byId = Object.fromEntries(grouped.map((g) => [String(g._id), g]))
    res.json({
      items: workshops.map((w) => ({
        ...w,
        registered: byId[String(w._id)]?.registered || 0,
        attended: byId[String(w._id)]?.attended || 0,
        seatsLeft: Math.max(0, (w.capacity || 0) - (byId[String(w._id)]?.registered || 0)),
      })),
    })
  }),
)

router.use('/', crudRouter(Workshop, { searchFields: ['title', 'slug'], sort: { startsAt: -1 } }))

export default router
