import mongoose from 'mongoose'

const practiceItemSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    type: { type: String, default: 'Drill' },
    difficulty: { type: String, default: 'Beginner' },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    description: String,
    questionCount: Number,
    minutes: Number,
    // per-student state is tracked here so /student/practice can show progress
    attempts: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        status: {
          type: String,
          enum: ['Not started', 'In progress', 'Completed'],
          default: 'Not started',
        },
        score: Number,
        attemptedAt: Date,
      },
    ],
  },
  { timestamps: true },
)

export default mongoose.model('PracticeItem', practiceItemSchema)
