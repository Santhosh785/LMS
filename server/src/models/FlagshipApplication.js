import mongoose from 'mongoose'

/**
 * A submission from /programs/apply — the Flagship cohort application the 2026
 * redesign introduced.
 *
 * This is the most valuable form on the site: it is the only route into a
 * ten-seat, ₹79,999 programme, and the essays are what the team scores to pick
 * a batch. It gets its own collection rather than being folded into `Lead`
 * because a lead is a name and a phone number, while this is a reviewable
 * document with a decision attached.
 *
 * Every question from the drop is stored, including the ones the form only
 * shows conditionally — an applicant who switches from "scholarship" back to
 * "pay in full" should not silently keep an orphaned essay, so the route clears
 * those rather than the schema forbidding them.
 */
const flagshipApplicationSchema = new mongoose.Schema(
  {
    /* ------------------------------- contact ------------------------------- */
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    phone: { type: String, required: true, trim: true },
    linkedin: String,
    city: { type: String, required: true },
    state: { type: String, required: true },

    /* ----------------------------- preferences ----------------------------- */
    trackPreference: {
      type: String,
      enum: ['track-a', 'track-b', 'undecided'],
      required: true,
    },
    batchPreference: {
      type: String,
      enum: ['batch-4', 'batch-5-waitlist', 'flexible'],
      required: true,
    },
    mentoringLanguage: { type: String, required: true },
    currentStatus: { type: String, required: true },
    employer: String,

    /* ------------------------------ readiness ------------------------------ */
    weeklyHours: {
      type: String,
      enum: ['under-8', '8-10', '10-12', '12-15'],
      required: true,
    },
    /** At least one is required; enforced in the route, not the schema. */
    liveAvailability: { type: [String], default: [] },
    hasSetup: { type: String, enum: ['yes', 'partial', 'no'], required: true },
    masterclassCity: { type: String, required: true },
    scheduleBlockers: String,

    /* ----------------------------- background ------------------------------ */
    experienceLevel: {
      type: String,
      enum: [
        'exploring',
        'complete-beginner',
        'some-campaigns',
        'working-marketer',
        'founder-operator',
      ],
      required: true,
    },
    channels: { type: [String], default: [] },
    // Shown only to experienced applicants.
    monthlySpend: String,
    toolsUsed: String,
    portfolioUrl: String,
    // Shown only to beginners.
    starterCourses: String,

    /* -------------------------------- goals -------------------------------- */
    referralSource: { type: String, required: true },
    referralDetail: { type: String, required: true },
    whyFlagship: { type: String, required: true },
    twelveWeekOutcome: { type: String, required: true },
    shipStory: { type: String, required: true },
    curriculumHook: { type: String, required: true },

    /* ----------------------------- investment ------------------------------ */
    paymentPlan: { type: String, enum: ['full', 'scholarship'], required: true },
    /** Required by the route when `paymentPlan` is `scholarship`. */
    scholarshipCase: String,

    /**
     * Consent is stored, not just checked. "I agree to be contacted on
     * WhatsApp" is a claim the business may later have to evidence, so the
     * answer and the moment it was given are kept.
     */
    consentWhatsapp: { type: Boolean, required: true },
    consentAccurate: { type: Boolean, required: true },

    /* ------------------------------- pipeline ------------------------------ */
    status: {
      type: String,
      enum: ['New', 'Shortlisted', 'Fit call booked', 'Accepted', 'Waitlisted', 'Rejected'],
      default: 'New',
      index: true,
    },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    notes: [
      {
        body: { type: String, required: true },
        author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        authorName: String,
        at: { type: Date, default: Date.now },
      },
    ],
    /** Stamped once, the first time the application leaves `New`. */
    reviewedAt: Date,
    /** Stamped once, on the first move to a terminal status. */
    decidedAt: Date,

    /** Which page the applicant arrived from, for attribution. */
    page: String,
  },
  { timestamps: true },
)

/** The inbox lists newest first and filters by status. */
flagshipApplicationSchema.index({ createdAt: -1 })

export default mongoose.model('FlagshipApplication', flagshipApplicationSchema)
