import mongoose from 'mongoose'

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    product: String,
    joinedAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['Active', 'Trial'], default: 'Active', index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
)

export default mongoose.model('Customer', customerSchema)
