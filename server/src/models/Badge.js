import mongoose from 'mongoose'

const badgeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    icon: { type: String, default: '🛡' },
    tone: { type: String, default: 'gold' },
    description: String,
    automationEnabled: { type: Boolean, default: false },
    assignWhen: {
      type: String,
      enum: ['Seeds points', 'Select course / service'],
      default: 'Seeds points',
    },
    seedsThreshold: { type: Number, default: 0 },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    holderCount: { type: Number, default: 0 },
  },
  { timestamps: true },
)

export default mongoose.model('Badge', badgeSchema)
