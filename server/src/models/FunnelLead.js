import mongoose from 'mongoose'

const funnelLeadSchema = new mongoose.Schema(
  {
    funnelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Funnel', index: true },
    name: String,
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: String,
    sourceStep: String,
    date: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['New', 'Nurture', 'Purchased', 'Unsubscribed'],
      default: 'New',
      index: true,
    },
  },
  { timestamps: true },
)

export default mongoose.model('FunnelLead', funnelLeadSchema)
