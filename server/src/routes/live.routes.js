import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler, HttpError } from '../middleware/error.js'
import { and, asc, desc, eq, gte, lt } from 'drizzle-orm'
import { db, withMongoId } from '../db/index.js'
import { isUuid } from '../db/coerce.js'
import { bookings, liveBookings, liveClasses } from '../db/schema/index.js'

const router = Router()

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const now = new Date()
    const [upcoming, past, oneOnOne] = await Promise.all([
      db
        .select()
        .from(liveClasses)
        .where(gte(liveClasses.startsAt, now))
        .orderBy(asc(liveClasses.startsAt)),
      db
        .select()
        .from(liveClasses)
        .where(lt(liveClasses.startsAt, now))
        .orderBy(desc(liveClasses.startsAt))
        .limit(10),
      db.select().from(liveBookings).orderBy(asc(liveBookings.when)),
    ])

    let bookedIds = []
    if (req.user) {
      const mine = await db
        .select({ liveClassId: bookings.liveClassId })
        .from(bookings)
        .where(eq(bookings.userId, req.user.id))
      bookedIds = mine.map((b) => String(b.liveClassId))
    }

    res.json({
      upcoming: withMongoId(upcoming),
      past: withMongoId(past),
      oneOnOne: withMongoId(oneOnOne),
      bookedIds,
    })
  }),
)

router.post(
  '/:id/book',
  requireAuth,
  asyncHandler(async (req, res) => {
    const [liveClass] = isUuid(req.params.id)
      ? await db.select().from(liveClasses).where(eq(liveClasses.id, req.params.id))
      : []
    if (!liveClass) throw new HttpError(404, 'Session not found')

    // Insert-or-keep: booking twice is not an error and does not reset the row.
    await db
      .insert(bookings)
      .values({
        liveClassId: liveClass.id,
        userId: req.user.id,
        slot: liveClass.startsAt,
        status: 'Booked',
      })
      .onConflictDoNothing({ target: [bookings.liveClassId, bookings.userId] })
    const [booking] = await db
      .select()
      .from(bookings)
      .where(and(eq(bookings.liveClassId, liveClass.id), eq(bookings.userId, req.user.id)))
    res.status(201).json(withMongoId(booking))
  }),
)

export default router
