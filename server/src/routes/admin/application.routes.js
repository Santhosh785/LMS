import { Router } from 'express'
import { asyncHandler, HttpError } from '../../middleware/error.js'
import { desc, eq } from 'drizzle-orm'
import { db, withMongoId } from '../../db/index.js'
import { fitCallBookings, flagshipApplications } from '../../db/schema/index.js'
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

const APPLICATION_SEARCH = ['fullName', 'email', 'phone', 'city']
const FIT_CALL_SEARCH = ['fullName', 'email', 'phone']

/** The essays are long; the list view never needs them. */
const ESSAYS = [
  'whyFlagship',
  'twelveWeekOutcome',
  'shipStory',
  'curriculumHook',
  'scholarshipCase',
]

/* ----------------------------- applications ----------------------------- */

router.get(
  '/applications',
  asyncHandler(async (req, res) => {
    const filter = inboxWhere('application', req.query, APPLICATION_SEARCH)
    const limit = Math.min(Number(req.query.limit) || 50, 200)
    const skip = Number(req.query.skip) || 0

    const [items, total, counts] = await Promise.all([
      listInbox('application', { where: filter, limit, offset: skip, omit: ESSAYS }),
      countInbox('application', filter),
      // Board counts ignore the status filter, or picking one would zero the
      // others and the tab row would stop being a summary.
      statusCounts('application'),
    ])

    res.json({
      items,
      total,
      statuses: APPLICATION_STATUSES,
      counts: Object.fromEntries(counts.map((c) => [c.status || 'New', c.n])),
    })
  }),
)

router.get(
  '/applications/export',
  asyncHandler(async (req, res) => {
    const rows = await listInbox('application', {
      where: inboxWhere('application', req.query, APPLICATION_SEARCH),
    })

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
      {
        key: 'liveAvailability',
        label: 'Availability',
        get: (r) => (r.liveAvailability || []).join(' | '),
      },
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
    const doc = await getInboxDoc('application', req.params.id)
    if (!doc) throw new HttpError(404, 'Application not found')
    // Surfaced together so a reviewer can see the person already booked a call.
    const fitCalls = await db
      .select({
        id: fitCallBookings.id,
        status: fitCallBookings.status,
        scheduledAt: fitCallBookings.scheduledAt,
        preferredSlots: fitCallBookings.preferredSlots,
        createdAt: fitCallBookings.createdAt,
      })
      .from(fitCallBookings)
      .where(eq(fitCallBookings.email, doc.email))
      .orderBy(desc(fitCallBookings.createdAt))
    res.json({ ...doc, fitCalls: withMongoId(fitCalls) })
  }),
)

router.put(
  '/applications/:id',
  asyncHandler(async (req, res) => {
    const doc = await getInboxRow('application', req.params.id)
    if (!doc) throw new HttpError(404, 'Application not found')

    const { status, owner } = req.body
    const patch = {}
    if (status !== undefined) {
      if (!APPLICATION_STATUSES.includes(status)) throw new HttpError(400, 'Unknown status')
      // Both stamps are written once. Re-saving a decided application must not
      // keep moving its dates forward — they are what "time to decision" is
      // measured from.
      if (status !== 'New' && !doc.reviewedAt) patch.reviewedAt = new Date()
      if (TERMINAL.has(status) && !doc.decidedAt) patch.decidedAt = new Date()
      patch.status = status
    }
    if (owner !== undefined) patch.owner = await resolveOwner(owner)

    res.json(await updateInbox('application', doc.id, patch))
  }),
)

router.post(
  '/applications/:id/notes',
  asyncHandler(async (req, res) => {
    const body = req.body?.body?.trim()
    if (!body) throw new HttpError(400, 'Write something first')

    const doc = await addNote('application', req.params.id, {
      body,
      author: req.user.id,
      authorName: req.user.name,
    })
    if (!doc) throw new HttpError(404, 'Application not found')
    res.json(doc)
  }),
)

/* ------------------------------- fit calls ------------------------------- */

router.get(
  '/fit-calls',
  asyncHandler(async (req, res) => {
    const filter = inboxWhere('fitCall', req.query, FIT_CALL_SEARCH)
    const limit = Math.min(Number(req.query.limit) || 50, 200)
    const skip = Number(req.query.skip) || 0

    const [items, total, counts] = await Promise.all([
      listInbox('fitCall', { where: filter, limit, offset: skip }),
      countInbox('fitCall', filter),
      statusCounts('fitCall'),
    ])

    res.json({
      items,
      total,
      statuses: FIT_CALL_STATUSES,
      counts: Object.fromEntries(counts.map((c) => [c.status || 'Requested', c.n])),
    })
  }),
)

router.get(
  '/fit-calls/export',
  asyncHandler(async (req, res) => {
    const rows = await listInbox('fitCall', {
      where: inboxWhere('fitCall', req.query, FIT_CALL_SEARCH),
    })

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
    const doc = await getInboxDoc('fitCall', req.params.id)
    if (!doc) throw new HttpError(404, 'Fit call not found')
    const applications = await db
      .select({
        id: flagshipApplications.id,
        status: flagshipApplications.status,
        trackPreference: flagshipApplications.trackPreference,
        createdAt: flagshipApplications.createdAt,
      })
      .from(flagshipApplications)
      .where(eq(flagshipApplications.email, doc.email))
      .orderBy(desc(flagshipApplications.createdAt))
    res.json({ ...doc, applications: withMongoId(applications) })
  }),
)

router.put(
  '/fit-calls/:id',
  asyncHandler(async (req, res) => {
    const doc = await getInboxRow('fitCall', req.params.id)
    if (!doc) throw new HttpError(404, 'Fit call not found')

    const { status, owner, scheduledAt } = req.body
    const patch = {}
    if (status !== undefined) {
      if (!FIT_CALL_STATUSES.includes(status)) throw new HttpError(400, 'Unknown status')
      patch.status = status
    }
    if (owner !== undefined) patch.owner = await resolveOwner(owner)
    if (scheduledAt !== undefined) patch.scheduledAt = scheduledAt ? new Date(scheduledAt) : null

    res.json(await updateInbox('fitCall', doc.id, patch))
  }),
)

router.post(
  '/fit-calls/:id/notes',
  asyncHandler(async (req, res) => {
    const body = req.body?.body?.trim()
    if (!body) throw new HttpError(400, 'Write something first')

    const doc = await addNote('fitCall', req.params.id, {
      body,
      author: req.user.id,
      authorName: req.user.name,
    })
    if (!doc) throw new HttpError(404, 'Fit call not found')
    res.json(doc)
  }),
)

export default router
