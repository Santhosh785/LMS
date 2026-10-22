import mongoose from 'mongoose'

const channelSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true, lowercase: true, index: true },
    group: {
      type: String,
      enum: ['Yoda Class Cohort', 'Growth Scholar Hub', 'Group Chats'],
      default: 'Growth Scholar Hub',
      index: true,
    },
    description: String,
    order: { type: Number, default: 0 },
    memberIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true },
)

export default mongoose.model('Channel', channelSchema)
