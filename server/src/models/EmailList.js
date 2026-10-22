import mongoose from 'mongoose'

const emailListSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: String,
    contactCount: { type: Number, default: 0 },
  },
  { timestamps: true },
)

export default mongoose.model('EmailList', emailListSchema)
