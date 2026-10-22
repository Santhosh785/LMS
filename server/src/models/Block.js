import mongoose from 'mongoose'

/**
 * One member choosing not to see another.
 *
 * Kept as simple as it can be: **mutual invisibility, and no notification to the
 * blocked party.** Telling someone they have been blocked is what turns a quiet
 * exit from a conversation into an escalation, and the person doing the blocking
 * is usually the one who wants it to stop.
 *
 * "Mutual" means the feed filter looks in both directions — B's posts vanish for
 * A, and A's vanish for B — so blocking cannot be used to keep watching someone
 * who has no way to see you.
 */
const blockSchema = new mongoose.Schema(
  {
    blockerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    blockedId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  },
  { timestamps: true },
)

blockSchema.index({ blockerId: 1, blockedId: 1 }, { unique: true })

export default mongoose.model('Block', blockSchema)
