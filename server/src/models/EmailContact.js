import mongoose from 'mongoose'

const emailContactSchema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    listIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'EmailList' }],
    status: {
      type: String,
      enum: ['Subscribed', 'Unsubscribed'],
      default: 'Subscribed',
      index: true,
    },
    joinedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
)

export default mongoose.model('EmailContact', emailContactSchema)
