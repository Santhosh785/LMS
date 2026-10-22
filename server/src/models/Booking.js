import mongoose from 'mongoose'

/** A student's seat in a scheduled live class. */
const bookingSchema = new mongoose.Schema(
  {
    liveClassId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LiveClass',
      required: true,
      index: true,
    },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    slot: Date,
    status: { type: String, enum: ['Booked', 'Attended', 'Cancelled'], default: 'Booked' },
  },
  { timestamps: true },
)

bookingSchema.index({ liveClassId: 1, userId: 1 }, { unique: true })

export default mongoose.model('Booking', bookingSchema)
