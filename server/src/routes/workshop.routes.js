import { Router } from 'express'
import { body } from 'express-validator'
import { validate } from '../middleware/validate.js'
import { asyncHandler, HttpError } from '../middleware/error.js'
import { and, eq, sql } from 'drizzle-orm'
import { db, withMongoId } from '../db/index.js'
import { isUuid } from '../db/coerce.js'
import { workshopRegistrations, workshops } from '../db/schema/index.js'
import { queueMail } from '../jobs/mail.js'
import { listWorkshops } from '../db/repos/workshops.js'

const router = Router()

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const items = await listWorkshops({ mode: req.query.mode, language: req.query.language })
    res.json({ items })
  }),
)

router.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const [workshop] = await db
      .select()
      .from(workshops)
      .where(eq(workshops.slug, String(req.params.slug).toLowerCase()))
    if (!workshop) throw new HttpError(404, 'Workshop not found')
    res.json(withMongoId(workshop))
  }),
)

router.post(
  '/:id/register',
  body('email').isEmail().withMessage('Enter a valid email').normalizeEmail(),
  validate,
  asyncHandler(async (req, res) => {
    const [workshop] = isUuid(req.params.id)
      ? await db.select().from(workshops).where(eq(workshops.id, req.params.id))
      : []
    if (!workshop) throw new HttpError(404, 'Workshop not found')

    /**
     * Idempotent. Registering twice used to create a second document and add
     * another to `registeredCount`, so anyone could inflate the number on a
     * workshop page by refreshing the form.
     *
     * Returning the existing registration rather than erroring is the friendlier
     * half of that: someone who double-taps Register, or comes back to check
     * they did it, should be told they are in — not shown a failure.
     */
    const identity = req.user
      ? eq(workshopRegistrations.userId, req.user.id)
      : eq(workshopRegistrations.guestEmail, req.body.email)

    const [existing] = await db
      .select({ id: workshopRegistrations.id })
      .from(workshopRegistrations)
      .where(and(eq(workshopRegistrations.workshopId, workshop.id), identity))
    if (existing) {
      return res.status(200).json({
        ok: true,
        alreadyRegistered: true,
        registeredCount: workshop.registeredCount,
      })
    }

    // The insert and the counter move together: a registration that commits
    // without its increment would let the displayed count drift from reality.
    const updated = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(workshopRegistrations)
        .values({
          workshopId: workshop.id,
          userId: req.user?.id ?? null,
          guestName: req.body.name || null,
          guestEmail: req.body.email,
          guestPhone: req.body.phone || null,
        })
        // A partial unique index caught a duplicate the check above raced past.
        .onConflictDoNothing()
        .returning({ id: workshopRegistrations.id })
      if (!inserted) return null

      // Increment in SQL, not read-modify-write — concurrent registrations
      // would otherwise lose increments.
      const [row] = await tx
        .update(workshops)
        .set({ registeredCount: sql`${workshops.registeredCount} + 1` })
        .where(eq(workshops.id, workshop.id))
        .returning({ registeredCount: workshops.registeredCount })
      return row
    })
    if (!updated) {
      return res.status(200).json({
        ok: true,
        alreadyRegistered: true,
        registeredCount: workshop.registeredCount,
      })
    }

    // Queued and retried on a provider failure; queuing never rejects, so a
    // bounced confirmation cannot turn a successful registration into an error.
    await queueMail('workshop-confirmation', req.body.email, {
      name: req.body.name || req.user?.name || 'there',
      workshopTitle: workshop.title,
      startsAt: workshop.startsAt,
      language: workshop.language,
      mode: workshop.mode,
      // No join link is held on the Workshop record, so the template says the
      // link follows rather than rendering a dead button.
    })

    res.status(201).json({ ok: true, registeredCount: updated.registeredCount })
  }),
)

export default router
