import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler, HttpError } from '../middleware/error.js'
import { LiveClass, Booking, LiveBooking } from '../models/index.js'

const router = Router()

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const now = new Date()
    const [upcoming, past, oneOnOne] = await Promise.all([
      LiveClass.find({ startsAt: { $gte: now } })
        .sort({ startsAt: 1 })
        .lean(),
      LiveClass.find({ startsAt: { $lt: now } })
        .sort({ startsAt: -1 })
        .limit(10)
        .lean(),
      LiveBooking.find().sort({ when: 1 }).lean(),
    ])

    let bookedIds = []
    if (req.user) {
      const bookings = await Booking.find({ userId: req.user._id }).select('liveClassId').lean()
      bookedIds = bookings.map((b) => String(b.liveClassId))
    }

    res.json({ upcoming, past, oneOnOne, bookedIds })
  }),
)

router.post(
  '/:id/book',
  requireAuth,
  asyncHandler(async (req, res) => {
    const liveClass = await LiveClass.findById(req.params.id)
    if (!liveClass) throw new HttpError(404, 'Session not found')

    const booking = await Booking.findOneAndUpdate(
      { liveClassId: liveClass._id, userId: req.user._id },
      { $setOnInsert: { slot: liveClass.startsAt, status: 'Booked' } },
      { new: true, upsert: true },
    )
    res.status(201).json(booking)
  }),
)

export default router
