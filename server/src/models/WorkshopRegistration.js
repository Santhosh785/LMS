import mongoose from 'mongoose'

const workshopRegistrationSchema = new mongoose.Schema(
  {
    workshopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workshop',
      required: true,
      index: true,
    },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    guest: { name: String, email: String, phone: String },

    /*
     * Registrations were write-only too: nobody running a workshop could see
     * who had signed up, let alone mark who turned up.
     */
    attended: { type: Boolean, default: false, index: true },
    /** Set when capacity was already full — a waitlist rather than a refusal. */
    waitlisted: { type: Boolean, default: false, index: true },
    cancelledAt: Date,
    note: String,
  },
  { timestamps: true },
)

/**
 * One registration per workshop per person.
 *
 * Two indexes rather than one, because a registration is identified two
 * different ways and a single index cannot cover both:
 *
 *   - **Signed in** — keyed on `userId`. The partial filter is what makes this
 *     work: without it every guest registration has `userId: null`, they all
 *     collide on `(workshopId, null)`, and the second guest for a workshop is
 *     rejected. `$exists: true` narrows the index to rows that actually have a
 *     user, leaving guests alone entirely.
 *
 *   - **Guest** — keyed on the email they gave, for the same reason: registering
 *     twice with one address inflated `registeredCount` each time.
 */
workshopRegistrationSchema.index(
  { workshopId: 1, userId: 1 },
  { unique: true, partialFilterExpression: { userId: { $exists: true, $type: 'objectId' } } },
)

workshopRegistrationSchema.index(
  { workshopId: 1, 'guest.email': 1 },
  { unique: true, partialFilterExpression: { 'guest.email': { $type: 'string' } } },
)

export default mongoose.model('WorkshopRegistration', workshopRegistrationSchema)
