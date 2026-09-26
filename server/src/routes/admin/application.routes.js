import { Router } from 'express'
import { asyncHandler, HttpError } from '../../middleware/error.js'
import { FitCallBooking, FlagshipApplication, User } from '../../models/index.js'
import { sendCsv } from '../../utils/csv.js'

const router = Router()

/**
 * The Flagship intake inboxes: applications and fit calls.
 *
 * Both public forms would otherwise be write-only — the same failure the leads
 * inbox was built to fix. An application is a ₹79,999 decision with five essays
 * attached, so it needs a readable detail view, a pipeline and a note trail,
 * not just a row in a list.
 */

const APPLICATION_STATUSES = [
  'New',
  'Shortlisted',
  'Fit call booked',
  'Accepted',
  'Waitlisted',
  'Rejected',
]
/** Statuses that represent a final answer, for the `decidedAt` stamp. */
const TERMINAL = new Set(['Accepted', 'Waitlisted', 'Rejected'])

const FIT_CALL_STATUSES = ['Requested', 'Scheduled', 'Completed', 'No-show', 'Cancelled']

const searchFilter = (query, fields) => {
  const filter = {}
  if (query.status) filter.status = query.status
  if (query.owner === 'unassigned') filter.owner = { $exists: false }
  else if (query.owner) filter.owner = query.owner

  const q = query.q?.trim()
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    filter.$or = fields.map((f) => ({ [f]: rx }))
  }
  if (query.from || query.to) {
    filter.createdAt = {}
    if (query.from) filter.createdAt.$gte = new Date(query.from)
    if (query.to) filter.createdAt.$lte = new Date(`${query.to}T23:59:59.999Z`)
  }
  return filter
}

/** Assigning an owner is the same three lines on both inboxes. */
async function resolveOwner(owner) {
  if (!owner) return undefined
  const assignee = await User.findById(owner).select('_id')
  if (!assignee) throw new HttpError(400, 'That owner does not exist')
  return assignee._id
}

/* ----------------------------- applications ----------------------------- */

router.get(
  '/applications',
  asyncHandler(async (req, res) => {
    const filter = searchFilter(req.query, ['fullName', 'email', 'phone', 'city'])
    const limit = Math.min(Number(req.query.limit) || 50, 200)
    const skip = Number(req.query.skip) || 0

    const [items, total, counts] = await Promise.all([
      FlagshipApplication.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        // The essays are long; the list view never needs them.
        .select('-whyFlagship -twelveWeekOutcome -shipStory -curriculumHook -scholarshipCase')
        .populate('owner', 'name email')
        .lean(),
      FlagshipApplication.countDocuments(filter),
      // Board counts ignore the status filter, or picking one would zero the
      // others and the tab row would stop being a summary.
      FlagshipApplication.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    ])

    res.json({
      items,
      total,
      statuses: APPLICATION_STATUSES,
      counts: Object.fromEntries(counts.map((c) => [c._id || 'New', c.count])),
    })
  }),
)

router.get(
  '/applications/export',
  asyncHandler(async (req, res) => {
    const rows = await FlagshipApplication.find(
      searchFilter(req.query, ['fullName', 'email', 'phone', 'city']),
    )
      .sort({ createdAt: -1 })
      .populate('owner', 'name')
      .lean()

    sendCsv(res, 'flagship-applications.csv', rows, [
      { key: 'createdAt', label: 'Received', get: (r) => r.createdAt?.toISOString() },
      { key: 'fullName', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'city', label: 'City' },
      { key: 'state', label: 'State' },
      { key: 'status', label: 'Status' },
      { key: 'owner', label: 'Owner', get: (r) => r.owner?.name || '' },
      { key: 'trackPreference', label: 'Track' },
      { key: 'batchPreference', label: 'Batch' },
      { key: 'currentStatus', label: 'Current status' },
      { key: 'experienceLevel', label: 'Experience' },
      { key: 'weeklyHours', label: 'Weekly hours' },
      { key: 'liveAvailability', label: 'Availability', get: (r) => (r.liveAvailability || []).join(' | ') },
      { key: 'channels', label: 'Channels', get: (r) => (r.channels || []).join(' | ') },
      { key: 'masterclassCity', label: 'Masterclass city' },
      { key: 'paymentPlan', label: 'Payment plan' },
      { key: 'referralSource', label: 'Referral source' },
      { key: 'referralDetail', label: 'Referral detail' },
      { key: 'notes', label: 'Notes', get: (r) => (r.notes || []).map((n) => n.body).join(' | ') },
    ])
  }),
)

router.get(
  '/applications/:id',
  asyncHandler(async (req, res) => {
    const doc = await FlagshipApplication.findById(req.params.id)
      .populate('owner', 'name email')
      .lean()
    if (!doc) throw new HttpError(404, 'Application not found')
    // Surfaced together so a reviewer can see the person already booked a call.
    const fitCalls = await FitCallBooking.find({ email: doc.email })
      .sort({ createdAt: -1 })
      .select('status scheduledAt preferredSlots createdAt')
      .lean()
    res.json({ ...doc, fitCalls })
  }),
)

router.put(
  '/applications/:id',
  asyncHandler(async (req, res) => {
    const doc = await FlagshipApplication.findById(req.params.id)
    if (!doc) throw new HttpError(404, 'Application not found')

    const { status, owner } = req.body
    if (status !== undefined) {
      if (!APPLICATION_STATUSES.includes(status)) throw new HttpError(400, 'Unknown status')
      // Both stamps are written once. Re-saving a decided application must not
      // keep moving its dates forward — they are what "time to decision" is
      // measured from.
      if (status !== 'New' && !doc.reviewedAt) doc.reviewedAt = new Date()
      if (TERMINAL.has(status) && !doc.decidedAt) doc.decidedAt = new Date()
      doc.status = status
    }
    if (owner !== undefined) doc.owner = await resolveOwner(owner)

    await doc.save()
    res.json(await FlagshipApplication.findById(doc._id).populate('owner', 'name email').lean())
  }),
)

router.post(
  '/applications/:id/notes',
  asyncHandler(async (req, res) => {
    const body = req.body?.body?.trim()
    if (!body) throw new HttpError(400, 'Write something first')

    const doc = await FlagshipApplication.findByIdAndUpdate(
      req.params.id,
      { $push: { notes: { body, author: req.user._id, authorName: req.user.name } } },
      { new: true },
    )
      .populate('owner', 'name email')
      .lean()
    if (!doc) throw new HttpError(404, 'Application not found')
    res.json(doc)
  }),
)

/* ------------------------------- fit calls ------------------------------- */

router.get(
  '/fit-calls',
  asyncHandler(async (req, res) => {
    const filter = searchFilter(req.query, ['fullName', 'email', 'phone'])
    const limit = Math.min(Number(req.query.limit) || 50, 200)
    const skip = Number(req.query.skip) || 0

    const [items, total, counts] = await Promise.all([
      FitCallBooking.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('owner', 'name email')
        .lean(),
      FitCallBooking.countDocuments(filter),
      FitCallBooking.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    ])

    res.json({
      items,
      total,
      statuses: FIT_CALL_STATUSES,
      counts: Object.fromEntries(counts.map((c) => [c._id || 'Requested', c.count])),
    })
  }),
)

router.get(
  '/fit-calls/export',
  asyncHandler(async (req, res) => {
    const rows = await FitCallBooking.find(searchFilter(req.query, ['fullName', 'email', 'phone']))
      .sort({ createdAt: -1 })
      .populate('owner', 'name')
      .lean()

    sendCsv(res, 'fit-calls.csv', rows, [
      { key: 'createdAt', label: 'Requested', get: (r) => r.createdAt?.toISOString() },
      { key: 'fullName', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'status', label: 'Status' },
      { key: 'scheduledAt', label: 'Scheduled', get: (r) => r.scheduledAt?.toISOString() || '' },
      { key: 'owner', label: 'Owner', get: (r) => r.owner?.name || '' },
      { key: 'preferredWeek', label: 'Preferred week' },
      { key: 'preferredSlots', label: 'Slots', get: (r) => (r.preferredSlots || []).join(' | ') },
      { key: 'timezone', label: 'Timezone' },
      { key: 'submittedFullApplication', label: 'Applied?' },
      { key: 'currentStatus', label: 'Current role' },
      { key: 'weeklyHours', label: 'Weekly hours' },
      { key: 'biggestBlocker', label: 'Biggest blocker' },
      { key: 'referralSource', label: 'Referral' },
      { key: 'callQuestions', label: 'Questions' },
      { key: 'notes', label: 'Notes', get: (r) => (r.notes || []).map((n) => n.body).join(' | ') },
    ])
  }),
)

router.get(
  '/fit-calls/:id',
  asyncHandler(async (req, res) => {
    const doc = await FitCallBooking.findById(req.params.id)
      .populate('owner', 'name email')
      .lean()
    if (!doc) throw new HttpError(404, 'Fit call not found')
    const applications = await FlagshipApplication.find({ email: doc.email })
      .sort({ createdAt: -1 })
      .select('status trackPreference createdAt')
      .lean()
    res.json({ ...doc, applications })
  }),
)

router.put(
  '/fit-calls/:id',
  asyncHandler(async (req, res) => {
    const doc = await FitCallBooking.findById(req.params.id)
    if (!doc) throw new HttpError(404, 'Fit call not found')

    const { status, owner, scheduledAt } = req.body
    if (status !== undefined) {
      if (!FIT_CALL_STATUSES.includes(status)) throw new HttpError(400, 'Unknown status')
      doc.status = status
    }
    if (owner !== undefined) doc.owner = await resolveOwner(owner)
    if (scheduledAt !== undefined) doc.scheduledAt = scheduledAt ? new Date(scheduledAt) : undefined

    await doc.save()
    res.json(await FitCallBooking.findById(doc._id).populate('owner', 'name email').lean())
  }),
)

router.post(
  '/fit-calls/:id/notes',
  asyncHandler(async (req, res) => {
    const body = req.body?.body?.trim()
    if (!body) throw new HttpError(400, 'Write something first')

    const doc = await FitCallBooking.findByIdAndUpdate(
      req.params.id,
      { $push: { notes: { body, author: req.user._id, authorName: req.user.name } } },
      { new: true },
    )
      .populate('owner', 'name email')
      .lean()
    if (!doc) throw new HttpError(404, 'Fit call not found')
    res.json(doc)
  }),
)

export default router
