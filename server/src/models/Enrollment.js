import mongoose from 'mongoose'

const enrollmentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    progressPct: { type: Number, default: 0, min: 0, max: 100 },
    completedLessonIds: [mongoose.Schema.Types.ObjectId],
    currentSectionId: mongoose.Schema.Types.ObjectId,
    currentLessonId: mongoose.Schema.Types.ObjectId,
    lastAccessedAt: Date,
    enrolledAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['Active', 'Completed', 'Not started'],
      default: 'Not started',
    },
    /**
     * When access ends. Null means lifetime — `Course.pricingPlans` sells
     * Lifetime, 12 months and 6 months, and before this field every tier
     * granted permanent access. Documents written before this field exists read
     * back as null, which is the pre-existing behaviour, so no migration.
     */
    expiresAt: { type: Date, default: null },
    /** Why this person has access. See services/access.js. */
    source: {
      type: String,
      enum: ['paid', 'manual', 'free'],
      default: 'manual',
    },
  },
  { timestamps: true },
)

enrollmentSchema.index({ userId: 1, courseId: 1 }, { unique: true })

export default mongoose.model('Enrollment', enrollmentSchema)
