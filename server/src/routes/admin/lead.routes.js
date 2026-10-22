import { Router } from 'express'
import { asyncHandler, HttpError } from '../../middleware/error.js'
import { Lead, User } from '../../models/index.js'
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

const buildFilter = (query) => {
  const filter = {}
  if (query.status) filter.status = query.status
  if (query.source) filter.source = query.source
  if (query.owner === 'unassigned') filter.owner = { $exists: false }
  else if (query.owner) filter.owner = query.owner

  const q = query.q?.trim()
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }]
  }
  if (query.from || query.to) {
    filter.createdAt = {}
    if (query.from) filter.createdAt.$gte = new Date(query.from)
    if (query.to) filter.createdAt.$lte = new Date(`${query.to}T23:59:59.999Z`)
  }
  return filter
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter = buildFilter(req.query)
    const limit = Math.min(Number(req.query.limit) || 50, 200)
    const skip = Number(req.query.skip) || 0

    const [items, total, counts, sources] = await Promise.all([
      Lead.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('owner', 'name email')
        .lean(),
      Lead.countDocuments(filter),
      // Board counts ignore the status filter, or selecting one would zero the
      // others and the tab row would stop being a summary.
      Lead.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Lead.distinct('source'),
    ])

    res.json({
      items,
      total,
      statuses: STATUSES,
      counts: Object.fromEntries(counts.map((c) => [c._id || 'New', c.count])),
      sources: sources.filter(Boolean).sort(),
    })
  }),
)

router.get(
  '/export',
  asyncHandler(async (req, res) => {
    const rows = await Lead.find(buildFilter(req.query))
      .sort({ createdAt: -1 })
      .populate('owner', 'name')
      .lean()

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
    const lead = await Lead.findById(req.params.id).populate('owner', 'name email').lean()
    if (!lead) throw new HttpError(404, 'Lead not found')
    res.json(lead)
  }),
)

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const lead = await Lead.findById(req.params.id)
    if (!lead) throw new HttpError(404, 'Lead not found')

    const { status, owner, nextFollowUpAt } = req.body
    if (status !== undefined) {
      if (!STATUSES.includes(status)) throw new HttpError(400, 'Unknown status')
      // Stamped once, on the first move to Converted, so re-saving the record
      // later does not keep moving the conversion date forward.
      if (status === 'Converted' && !lead.convertedAt) lead.convertedAt = new Date()
      lead.status = status
    }
    if (owner !== undefined) {
      if (owner) {
        const assignee = await User.findById(owner).select('_id')
        if (!assignee) throw new HttpError(400, 'That owner does not exist')
        lead.owner = assignee._id
      } else {
        lead.owner = undefined
      }
    }
    if (nextFollowUpAt !== undefined) {
      lead.nextFollowUpAt = nextFollowUpAt ? new Date(nextFollowUpAt) : undefined
    }

    await lead.save()
    res.json(await Lead.findById(lead._id).populate('owner', 'name email').lean())
  }),
)

router.post(
  '/:id/notes',
  asyncHandler(async (req, res) => {
    const body = req.body?.body?.trim()
    if (!body) throw new HttpError(400, 'Write something first')

    const lead = await Lead.findByIdAndUpdate(
      req.params.id,
      { $push: { notes: { body, author: req.user._id, authorName: req.user.name } } },
      { new: true },
    )
      .populate('owner', 'name email')
      .lean()
    if (!lead) throw new HttpError(404, 'Lead not found')
    res.json(lead)
  }),
)

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const lead = await Lead.findByIdAndDelete(req.params.id)
    if (!lead) throw new HttpError(404, 'Lead not found')
    res.json({ ok: true })
  }),
)

export default router
