import mongoose from 'mongoose'

/**
 * A request from /programs/fit-call — the 15-minute call that precedes a
 * Flagship admission decision.
 *
 * Separate from FlagshipApplication because the two are genuinely different
 * events: someone can book a call without applying, apply without booking, or
 * do both. `submittedFullApplication` records which of those the person
 * believes they did, and the admin screen matches on email.
 */
const fitCallBookingSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    phone: { type: String, required: true, trim: true },

    /* ------------------------------ scheduling ----------------------------- */
    timezone: { type: String, default: 'IST' },
    preferredWeek: String,
    /** At least one is required; enforced in the route. */
    preferredSlots: { type: [String], default: [] },
    callLanguage: String,
    scheduleNotes: String,

    /* -------------------------------- context ------------------------------ */
    currentStatus: String,
    weeklyHours: String,
    submittedFullApplication: {
      type: String,
      enum: ['yes', 'no', 'planning-to'],
      default: 'no',
    },
    whyCallNow: String,
    biggestBlocker: String,
    callQuestions: String,
    referralSource: String,

    consent: { type: Boolean, required: true },

    /* ------------------------------- pipeline ------------------------------ */
    status: {
      type: String,
      enum: ['Requested', 'Scheduled', 'Completed', 'No-show', 'Cancelled'],
      default: 'Requested',
      index: true,
    },
    /** Set when an operator confirms a slot. */
    scheduledAt: Date,
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    notes: [
      {
        body: { type: String, required: true },
        author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        authorName: String,
        at: { type: Date, default: Date.now },
      },
    ],

    page: String,
  },
  { timestamps: true },
)

fitCallBookingSchema.index({ createdAt: -1 })

export default mongoose.model('FitCallBooking', fitCallBookingSchema)
