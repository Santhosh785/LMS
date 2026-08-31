import mongoose from 'mongoose'

/**
 * A member flagging content for a human to look at.
 *
 * Deliberately lightweight, and deliberately not automated. Public
 * user-generated content with no removal mechanism is a genuine liability — the
 * first defamatory post could previously only be taken down with a direct
 * database edit — but automated profanity filtering is out of scope and wrong at
 * this scale. A human queue is the right answer for a community this size.
 */
const reportSchema = new mongoose.Schema(
  {
    targetType: { type: String, enum: ['post', 'comment'], required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    /** Who wrote the reported content — kept so the queue survives its deletion. */
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reason: {
      type: String,
      enum: ['spam', 'harassment', 'hate', 'sexual', 'misinformation', 'other'],
      default: 'other',
    },
    note: { type: String, trim: true, maxlength: 1000 },
    /** A copy of the text, so a moderator can judge a post already deleted. */
    excerpt: { type: String, maxlength: 500 },
    status: {
      type: String,
      enum: ['open', 'actioned', 'dismissed'],
      default: 'open',
      index: true,
    },
    resolvedAt: Date,
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolution: String,
  },
  { timestamps: true },
)

// One report per person per item: re-reporting is noise, and letting one user
// stack twenty reports on the same post would make the queue an attack surface.
reportSchema.index({ targetId: 1, reporterId: 1 }, { unique: true })

// The moderation queue reads open reports, newest first.
reportSchema.index({ status: 1, createdAt: -1 })

export default mongoose.model('Report', reportSchema)
