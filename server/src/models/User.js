import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['student', 'admin'], default: 'student', index: true },
    /*
     * Suspension. Checked in attachUser, so a suspended account is refused on
     * the very next request rather than merely being unable to sign in again —
     * a seven-day cookie would otherwise outlive the suspension by a week.
     */
    suspendedAt: { type: Date, index: true },
    suspendedReason: String,
    avatarInitials: String,
    phone: String,
    education: String,
    currentProfile: String,
    preferredLanguage: String,
    // dashboard counters shown on /student
    streakDays: { type: Number, default: 0 },
    hoursThisWeek: { type: Number, default: 0 },
    seeds: { type: Number, default: 0 },
    weeklyGoalHours: { type: Number, default: 8 },

    /**
     * Password reset / set-password token (see services/passwordReset.js).
     * Stored as a SHA-256 of the token that was emailed, never the token itself,
     * so a database dump yields no working reset links. `select: false` keeps it
     * out of every ordinary query result by accident-proofing rather than
     * vigilance.
     */
    passwordResetTokenHash: { type: String, select: false, index: true },
    passwordResetExpiresAt: { type: Date, select: false },
    /**
     * When the password last changed. `attachUser` rejects any JWT issued before
     * this moment, so changing a password logs out sessions elsewhere — the
     * point of resetting a password someone else may know.
     */
    passwordChangedAt: { type: Date },
  },
  { timestamps: true },
)

userSchema.methods.checkPassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash)
}

userSchema.statics.hashPassword = function (plain) {
  return bcrypt.hash(plain, 10)
}

userSchema.pre('validate', function (next) {
  if (!this.avatarInitials && this.name) {
    this.avatarInitials = this.name
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase()
  }
  next()
})

export default mongoose.model('User', userSchema)
