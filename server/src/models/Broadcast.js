import mongoose from 'mongoose'

const broadcastSchema = new mongoose.Schema(
  {
    subject: { type: String, required: true },
    fromName: { type: String, default: 'Growth Scholar' },
    sendToListId: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailList' },
    sendToListName: String,
    body: String,
    status: { type: String, enum: ['draft', 'scheduled', 'sent'], default: 'draft', index: true },
    scheduledAt: Date,
    sentAt: Date,
    stats: {
      delivered: { type: Number, default: 0 },
      opened: { type: Number, default: 0 },
      clicked: { type: Number, default: 0 },
    },
  },
  { timestamps: true },
)

/**
 * The broadcasts table filters by status and orders by recency together, and the
 * single-field index on `status` alone cannot serve the sort — Mongo would fetch
 * every draft and sort them in memory.
 */
broadcastSchema.index({ status: 1, updatedAt: -1 })

export default mongoose.model('Broadcast', broadcastSchema)
