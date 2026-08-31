import mongoose from 'mongoose'

const pointRuleSchema = new mongoose.Schema(
  {
    activity: { type: String, required: true },
    points: { type: Number, default: 0 },
    order: { type: Number, default: 0 },
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true },
)

export default mongoose.model('PointRule', pointRuleSchema)
