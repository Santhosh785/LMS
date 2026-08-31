import { Router } from 'express'
import multer from 'multer'
import { crudRouter } from '../../utils/crudRouter.js'
import { asyncHandler, HttpError } from '../../middleware/error.js'
import { parseCsv } from '../../utils/csv.js'
import { EmailList, EmailContact, Broadcast } from '../../models/index.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })

/**
 * Deliberately permissive — it rejects "not an email", not exotic-but-valid
 * addresses. A stricter pattern would silently drop real subscribers, and the
 * only authority on whether an address exists is trying to deliver to it.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/* ------------------------------- broadcasts ------------------------------ */
router.post(
  '/broadcasts/:id/send',
  asyncHandler(async (req, res) => {
    const broadcast = await Broadcast.findById(req.params.id)
    if (!broadcast) throw new HttpError(404, 'Broadcast not found')
    if (broadcast.status === 'sent') throw new HttpError(409, 'Broadcast already sent')

    // No mail transport is wired up; sending records the send and its audience size.
    const recipients = await EmailContact.countDocuments({
      status: 'Subscribed',
      ...(broadcast.sendToListId ? { listIds: broadcast.sendToListId } : {}),
    })

    broadcast.status = 'sent'
    broadcast.sentAt = new Date()
    broadcast.stats = { delivered: recipients, opened: 0, clicked: 0 }
    await broadcast.save()

    res.json(broadcast)
  }),
)

router.use(
  '/broadcasts',
  crudRouter(Broadcast, {
    searchFields: ['subject', 'fromName', 'sendToListName'],
    sort: { createdAt: -1 },
  }),
)

/* --------------------------------- lists --------------------------------- */
router.use('/lists', crudRouter(EmailList, { searchFields: ['name'], sort: { updatedAt: -1 } }))

/* -------------------------------- contacts ------------------------------- */
router.post(
  '/contacts/import',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'Attach a CSV file')
    const rows = parseCsv(req.file.buffer)
    if (!rows.length) throw new HttpError(400, 'The CSV had no rows')

    const listIds = req.body.listId ? [req.body.listId] : []

    /**
     * Three queries regardless of row count.
     *
     * This loop used to run `EmailContact.findOne({ email })` per row and then a
     * save or create — a thousand-row import was ~2,000 sequential round trips,
     * which on Atlas is minutes of a held HTTP request. Now: one `$in` to fetch
     * what already exists, one `bulkWrite` to apply everything, one count
     * refresh.
     */

    // Deduplicate within the file itself. The same address twice in one CSV
    // would otherwise produce two bulk ops racing on the unique index.
    const seen = new Map()
    const rejected = []

    rows.forEach((row, i) => {
      const email = String(row.email || row.Email || '')
        .toLowerCase()
        .trim()
      const name = row.name || row.Name || ''
      // Validated per row, which the old version did not do at all: one
      // malformed address used to become a permanent contact nothing could mail.
      if (!email) {
        rejected.push({ row: i + 1, value: '', reason: 'No email column value' })
        return
      }
      if (!EMAIL_PATTERN.test(email)) {
        rejected.push({ row: i + 1, value: email, reason: 'Not a valid email address' })
        return
      }
      // Last occurrence wins, matching how the row-by-row version behaved.
      seen.set(email, { email, name })
    })

    const emails = [...seen.keys()]
    const existing = emails.length
      ? await EmailContact.find({ email: { $in: emails } })
          .select('email listIds')
          .lean()
      : []
    const existingByEmail = new Map(existing.map((c) => [c.email, c]))

    const ops = [...seen.values()].map(({ email, name }) => {
      const prev = existingByEmail.get(email)
      if (!prev) {
        return {
          insertOne: { document: { email, name, listIds, joinedAt: new Date() } },
        }
      }
      return {
        updateOne: {
          filter: { _id: prev._id },
          update: {
            // $addToSet, so re-importing into a second list adds to the
            // membership instead of replacing it.
            ...(listIds.length ? { $addToSet: { listIds: { $each: listIds } } } : {}),
            ...(name ? { $set: { name } } : {}),
          },
        },
      }
    })

    // `ordered: false` so one bad row does not abandon the rest of the file.
    if (ops.length) await EmailContact.bulkWrite(ops, { ordered: false })

    await refreshListCounts()

    const created = ops.filter((o) => o.insertOne).length
    res.status(201).json({
      created,
      updated: ops.length - created,
      total: rows.length,
      skipped: rejected.length,
      // Capped: a thousand-row file of nonsense should not return a
      // thousand-item error list into an admin table.
      rejected: rejected.slice(0, 50),
    })
  }),
)

router.use(
  '/contacts',
  crudRouter(EmailContact, {
    searchFields: ['name', 'email'],
    sort: { joinedAt: -1 },
    populate: 'listIds',
    dateField: 'joinedAt',
  }),
)

/**
 * Recomputes every list's contact count.
 *
 * Two queries regardless of how many lists exist. This used to run one
 * `countDocuments` and one `save` per list — the same N+1 shape as the CSV
 * import it is called from, so a large import paid for it twice.
 */
async function refreshListCounts() {
  const [lists, counts] = await Promise.all([
    EmailList.find().select('_id contactCount').lean(),
    EmailContact.aggregate([
      { $unwind: '$listIds' },
      { $group: { _id: '$listIds', n: { $sum: 1 } } },
    ]),
  ])

  const byList = new Map(counts.map((c) => [String(c._id), c.n]))
  const ops = lists
    .map((list) => ({ list, n: byList.get(String(list._id)) || 0 }))
    // Only write what actually changed.
    .filter(({ list, n }) => list.contactCount !== n)
    .map(({ list, n }) => ({
      updateOne: { filter: { _id: list._id }, update: { $set: { contactCount: n } } },
    }))

  if (ops.length) await EmailList.bulkWrite(ops, { ordered: false })
}

export default router
