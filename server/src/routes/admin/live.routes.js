import { Router } from 'express'
import { crudRouter } from '../../utils/crudRouter.js'
import { asyncHandler } from '../../middleware/error.js'
import { LiveClass, LiveBooking, Booking } from '../../models/index.js'

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

    const classes = await LiveClass.find({ startsAt: { $gte: start, $lt: end } })
      .sort({ startsAt: 1 })
      .lean()

    res.json({ year, month, classes })
  }),
)

/** Registrants for a given class (admin/live-bookings). */
router.get(
  '/classes/:id/registrants',
  asyncHandler(async (req, res) => {
    const items = await Booking.find({ liveClassId: req.params.id })
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .lean()
    res.json({ items, total: items.length })
  }),
)

router.use(
  '/classes',
  crudRouter(LiveClass, {
    searchFields: ['title', 'host'],
    sort: { startsAt: -1 },
    dateField: 'startsAt',
  }),
)

router.use(
  '/bookings',
  crudRouter(LiveBooking, { searchFields: ['topic'], sort: { when: -1 }, dateField: 'when' }),
)

export default router
