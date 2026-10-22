import mongoose from 'mongoose'

const certificateSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    courseTitle: String,
    issuedAt: { type: Date, default: Date.now },
    credentialId: { type: String, unique: true },
    status: { type: String, enum: ['Issued', 'In progress'], default: 'Issued' },
  },
  { timestamps: true },
)

export default mongoose.model('Certificate', certificateSchema)
