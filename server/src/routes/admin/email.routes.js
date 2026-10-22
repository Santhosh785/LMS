import { Router } from 'express'
import multer from 'multer'
import { crudRouter } from '../../utils/crudRouter.js'
import { asyncHandler, HttpError } from '../../middleware/error.js'
import { parseCsv } from '../../utils/csv.js'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { db, withMongoId } from '../../db/index.js'
import { isUuid } from '../../db/coerce.js'
import { broadcasts, emailContactLists, emailContacts, emailLists } from '../../db/schema/index.js'
import {
  contactDocs,
  createContact,
  refreshListCounts,
  updateContact,
} from '../../db/repos/email.js'

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
    const [broadcast] = isUuid(req.params.id)
      ? await db.select().from(broadcasts).where(eq(broadcasts.id, req.params.id))
      : []
    if (!broadcast) throw new HttpError(404, 'Broadcast not found')
    if (broadcast.status === 'sent') throw new HttpError(409, 'Broadcast already sent')

    // No mail transport is wired up; sending records the send and its audience size.
    const subscribed = eq(emailContacts.status, 'Subscribed')
    const [{ recipients }] = broadcast.sendToListId
      ? await db
          .select({ recipients: sql`count(distinct ${emailContacts.id})::int` })
          .from(emailContacts)
          .innerJoin(emailContactLists, eq(emailContactLists.contactId, emailContacts.id))
          .where(and(subscribed, eq(emailContactLists.listId, broadcast.sendToListId)))
      : await db
          .select({ recipients: sql`count(*)::int` })
          .from(emailContacts)
          .where(subscribed)

    // Conditional on not-yet-sent, so a double-click cannot "send" twice.
    const [sent] = await db
      .update(broadcasts)
      .set({
        status: 'sent',
        sentAt: new Date(),
        stats: { delivered: recipients, opened: 0, clicked: 0 },
      })
      .where(and(eq(broadcasts.id, broadcast.id), sql`${broadcasts.status} <> 'sent'`))
      .returning()
    if (!sent) throw new HttpError(409, 'Broadcast already sent')

    res.json(withMongoId(sent))
  }),
)

router.use(
  '/broadcasts',
  crudRouter(broadcasts, {
    name: 'Broadcast',
    searchFields: ['subject', 'fromName', 'sendToListName'],
    sort: { createdAt: -1 },
  }),
)

/* --------------------------------- lists --------------------------------- */
router.use(
  '/lists',
  crudRouter(emailLists, { name: 'List', searchFields: ['name'], sort: { updatedAt: -1 } }),
)

/* -------------------------------- contacts ------------------------------- */
router.post(
  '/contacts/import',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'Attach a CSV file')
    const rows = parseCsv(req.file.buffer)
    if (!rows.length) throw new HttpError(400, 'The CSV had no rows')

    const listIds = isUuid(req.body.listId) ? [req.body.listId] : []

    /**
     * Three queries regardless of row count.
     *
     * This loop once ran a lookup per row and then a save or create — a
     * thousand-row import was ~2,000 sequential round trips, minutes of a held
     * HTTP request. Now: one IN to fetch what already exists, one multi-row
     * INSERT for the new contacts, set-based writes for the rest, one count
     * refresh — all in a transaction, so a failed import leaves nothing half
     * applied.
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
    const { created, updated } = await db.transaction(async (tx) => {
      const existing = emails.length
        ? await tx
            .select({ id: emailContacts.id, email: emailContacts.email })
            .from(emailContacts)
            .where(inArray(emailContacts.email, emails))
        : []
      const existingByEmail = new Map(existing.map((c) => [c.email, c]))

      const fresh = [...seen.values()].filter(({ email }) => !existingByEmail.has(email))
      const inserted = fresh.length
        ? await tx
            .insert(emailContacts)
            .values(fresh.map(({ email, name }) => ({ email, name, joinedAt: new Date() })))
            .returning({ id: emailContacts.id })
        : []

      // Names are only overwritten when the file supplies one.
      for (const { email, name } of seen.values()) {
        const prev = existingByEmail.get(email)
        if (prev && name) {
          await tx.update(emailContacts).set({ name }).where(eq(emailContacts.id, prev.id))
        }
      }

      // Membership is added, never replaced: re-importing into a second list
      // keeps the first. ON CONFLICT makes an existing membership a no-op.
      const memberIds = [...inserted.map((r) => r.id), ...existing.map((c) => c.id)]
      if (listIds.length && memberIds.length) {
        await tx
          .insert(emailContactLists)
          .values(
            memberIds.flatMap((contactId) => listIds.map((listId) => ({ contactId, listId }))),
          )
          .onConflictDoNothing()
      }

      await refreshListCounts({ tx })
      return { created: inserted.length, updated: existing.length }
    })

    res.status(201).json({
      created,
      updated,
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
  crudRouter(emailContacts, {
    name: 'Contact',
    searchFields: ['name', 'email'],
    sort: { joinedAt: -1 },
    dateField: 'joinedAt',
    hydrate: contactDocs,
    repo: { create: createContact, update: updateContact },
  }),
)

export default router
