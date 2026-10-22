import mongoose from 'mongoose'

const liveClassSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: String,
    startsAt: { type: Date, required: true, index: true },
    durationMins: { type: Number, default: 60 },
    host: String,
    joinUrl: String,
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    status: { type: String, enum: ['Scheduled', 'Live', 'Ended'], default: 'Scheduled' },
    kind: { type: String, default: 'Workshop' },
    attendees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true },
)

export default mongoose.model('LiveClass', liveClassSchema)
