import { Router } from 'express'
import { crudRouter } from '../../utils/crudRouter.js'
import { asyncHandler } from '../../middleware/error.js'
import { and, asc, desc, eq, gte, lt } from 'drizzle-orm'
import { db, withMongoId } from '../../db/index.js'
import { isUuid } from '../../db/coerce.js'
import { bookings, liveBookings, liveClasses, users } from '../../db/schema/index.js'

const router = Router()

/** Calendar grid data for admin/live. */
router.get(
  '/calendar',
  asyncHandler(async (req, res) => {
    const now = new Date()
    const year = Number(req.query.year) || now.getFullYear()
    const month = Number(req.query.month ?? now.getMonth()) // 0-indexed

    const start = new Date(year, month, 1)
    const end = new Date(year, month + 1, 1)

    const classes = await db
      .select()
      .from(liveClasses)
      .where(and(gte(liveClasses.startsAt, start), lt(liveClasses.startsAt, end)))
      .orderBy(asc(liveClasses.startsAt))

    res.json({ year, month, classes: withMongoId(classes) })
  }),
)

/** Registrants for a given class (admin/live-bookings). */
router.get(
  '/classes/:id/registrants',
  asyncHandler(async (req, res) => {
    if (!isUuid(req.params.id)) return res.json({ items: [], total: 0 })
    const rows = await db
      .select({ booking: bookings, user: { id: users.id, name: users.name, email: users.email } })
      .from(bookings)
      .leftJoin(users, eq(users.id, bookings.userId))
      .where(eq(bookings.liveClassId, req.params.id))
      .orderBy(desc(bookings.createdAt))
    const items = rows.map((r) => withMongoId({ ...r.booking, userId: r.user }))
    res.json({ items, total: items.length })
  }),
)

router.use(
  '/classes',
  crudRouter(liveClasses, {
    name: 'Session',
    searchFields: ['title', 'host'],
    sort: { startsAt: -1 },
    dateField: 'startsAt',
  }),
)

router.use(
  '/bookings',
  crudRouter(liveBookings, {
    name: 'Booking',
    searchFields: ['topic'],
    sort: { when: -1 },
    dateField: 'when',
  }),
)

export default router
