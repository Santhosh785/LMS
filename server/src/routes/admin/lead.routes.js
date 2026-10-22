import { Router } from 'express'
import { asyncHandler, HttpError } from '../../middleware/error.js'
import { eq } from 'drizzle-orm'
import {
  addNote,
  countInbox,
  getInboxDoc,
  getInboxRow,
  inboxWhere,
  listInbox,
  resolveOwner,
  statusCounts,
  updateInbox,
} from '../../db/repos/crm.js'
import { db } from '../../db/index.js'
import { leads } from '../../db/schema/index.js'
import { sendCsv } from '../../utils/csv.js'

const router = Router()

/**
 * The leads inbox.
 *
 * `POST /api/leads` has been writing mentor-popup submissions to the database
 * since launch and no route ever read them back, so every enquiry the business
 * collected was invisible. This is the read side, plus the pipeline fields that
 * make the list actionable rather than just visible.
 */

const STATUSES = ['New', 'Contacted', 'Qualified', 'Lost', 'Converted']

const buildFilter = (query) =>
  inboxWhere('lead', query, ['name', 'email', 'phone'], { source: query.source })

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter = buildFilter(req.query)
    const limit = Math.min(Number(req.query.limit) || 50, 200)
    const skip = Number(req.query.skip) || 0

    const [items, total, counts, sources] = await Promise.all([
      listInbox('lead', { where: filter, limit, offset: skip }),
      countInbox('lead', filter),
      // Board counts ignore the status filter, or selecting one would zero the
      // others and the tab row would stop being a summary.
      statusCounts('lead'),
      db.selectDistinct({ source: leads.source }).from(leads),
    ])

    res.json({
      items,
      total,
      statuses: STATUSES,
      counts: Object.fromEntries(counts.map((c) => [c.status || 'New', c.n])),
      sources: sources
        .map((r) => r.source)
        .filter(Boolean)
        .sort(),
    })
  }),
)

router.get(
  '/export',
  asyncHandler(async (req, res) => {
    const rows = await listInbox('lead', { where: buildFilter(req.query) })

    sendCsv(res, 'leads.csv', rows, [
      { key: 'createdAt', label: 'Received', get: (r) => r.createdAt?.toISOString() },
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'status', label: 'Status' },
      { key: 'source', label: 'Source' },
      { key: 'owner', label: 'Owner', get: (r) => r.owner?.name || '' },
      { key: 'education', label: 'Education' },
      { key: 'profile', label: 'Profile' },
      { key: 'yearOfPassing', label: 'Year of passing' },
      { key: 'language', label: 'Language' },
      { key: 'page', label: 'Page' },
      { key: 'notes', label: 'Notes', get: (r) => (r.notes || []).map((n) => n.body).join(' | ') },
    ])
  }),
)

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const lead = await getInboxDoc('lead', req.params.id)
    if (!lead) throw new HttpError(404, 'Lead not found')
    res.json(lead)
  }),
)

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const lead = await getInboxRow('lead', req.params.id)
    if (!lead) throw new HttpError(404, 'Lead not found')

    const { status, owner, nextFollowUpAt } = req.body
    const patch = {}
    if (status !== undefined) {
      if (!STATUSES.includes(status)) throw new HttpError(400, 'Unknown status')
      // Stamped once, on the first move to Converted, so re-saving the record
      // later does not keep moving the conversion date forward.
      if (status === 'Converted' && !lead.convertedAt) patch.convertedAt = new Date()
      patch.status = status
    }
    if (owner !== undefined) patch.owner = await resolveOwner(owner)
    if (nextFollowUpAt !== undefined) {
      patch.nextFollowUpAt = nextFollowUpAt ? new Date(nextFollowUpAt) : null
    }

    res.json(await updateInbox('lead', lead.id, patch))
  }),
)

router.post(
  '/:id/notes',
  asyncHandler(async (req, res) => {
    const body = req.body?.body?.trim()
    if (!body) throw new HttpError(400, 'Write something first')

    const lead = await addNote('lead', req.params.id, {
      body,
      author: req.user.id,
      authorName: req.user.name,
    })
    if (!lead) throw new HttpError(404, 'Lead not found')
    res.json(lead)
  }),
)

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const lead = await getInboxRow('lead', req.params.id)
    if (!lead) throw new HttpError(404, 'Lead not found')
    await db.delete(leads).where(eq(leads.id, lead.id))
    res.json({ ok: true })
  }),
)

export default router
