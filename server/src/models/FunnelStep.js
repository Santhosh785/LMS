import mongoose from 'mongoose'

const funnelStepSchema = new mongoose.Schema(
  {
    funnelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Funnel', required: true, index: true },
    name: { type: String, required: true },
    order: { type: Number, default: 0 },
    url: String,
    uniqueVisitors: { type: Number, default: 0 },
    totalViews: { type: Number, default: 0 },
    conversionPct: { type: Number, default: 0 },
  },
  { timestamps: true },
)

export default mongoose.model('FunnelStep', funnelStepSchema)
