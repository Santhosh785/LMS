import mongoose from 'mongoose'

/** A creator-configured 1-1 booking slot (admin/live-bookings). */
const liveBookingSchema = new mongoose.Schema(
  {
    topic: { type: String, required: true },
    type: {
      type: String,
      enum: ['Single Session', 'Recurring Session'],
      default: 'Single Session',
    },
    when: Date,
    timeZone: { type: String, default: 'Asia/Kolkata' },
    maxRegistrants: { type: Number, default: 1 },
    duration: {
      type: String,
      enum: ['30 Minutes', '45 Minutes', '60 Minutes'],
      default: '30 Minutes',
    },
    passwordProtected: { type: Boolean, default: false },
    password: String,
    theme: {
      type: String,
      enum: ['Brand Green', 'Ocean', 'Warm Spotlight', 'Minimal Dark'],
      default: 'Brand Green',
    },
    description: String,
    bookedCount: { type: Number, default: 0 },
  },
  { timestamps: true },
)

export default mongoose.model('LiveBooking', liveBookingSchema)
