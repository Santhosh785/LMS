import mongoose from 'mongoose'

const leaderboardEntrySchema = new mongoose.Schema(
  {
    rank: { type: Number, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: String,
    email: String,
    badge: { type: String, default: '—' },
    points: { type: Number, default: 0 },
    service: String,
    period: { type: String, enum: ['week', 'month', 'all'], default: 'week', index: true },
    board: { type: String, default: 'Growth Master' },
  },
  { timestamps: true },
)

/**
 * The leaderboard is always read as "this board, this period, in rank order" —
 * one query shape, three fields. The existing single-field index on `period`
 * matched only the first of them, leaving the board filter and the sort to be
 * done in memory over every row.
 */
leaderboardEntrySchema.index({ board: 1, period: 1, rank: 1 })

export default mongoose.model('LeaderboardEntry', leaderboardEntrySchema)
