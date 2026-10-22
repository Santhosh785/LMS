import mongoose from 'mongoose'

const funnelSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, lowercase: true, index: true },
    template: {
      type: String,
      enum: ['Lead Magnet', 'Video Series', 'Survey Funnel'],
      default: 'Lead Magnet',
    },
    status: { type: String, enum: ['Live', 'Draft', 'Paused'], default: 'Draft', index: true },
    leadCount: { type: Number, default: 0 },
    description: String,
    domain: String,
    automationRules: [
      {
        trigger: String,
        action: String,
        delay: String,
        enabled: { type: Boolean, default: true },
      },
    ],
  },
  { timestamps: true },
)

export default mongoose.model('Funnel', funnelSchema)
