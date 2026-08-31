import mongoose from 'mongoose'

/** Submissions from the "Talk to a Growth Mentor" popup and the blog consult form. */
const leadSchema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true },
    education: String,
    profile: String,
    yearOfPassing: String,
    language: String,
    source: { type: String, default: 'mentor-popup', index: true },
    page: String,

    /*
     * Pipeline. Until this existed a lead was write-only — the mentor popup
     * created rows nothing could read, so every enquiry the business collected
     * was effectively lost. Statuses are a fixed set rather than free text so
     * the board can group by them; extending it is a schema change on purpose.
     */
    status: {
      type: String,
      enum: ['New', 'Contacted', 'Qualified', 'Converted', 'Lost'],
      default: 'New',
      index: true,
    },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    /** Free-text follow-up trail, newest last. */
    notes: [
      {
        body: { type: String, required: true },
        author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        authorName: String,
        at: { type: Date, default: Date.now },
      },
    ],
    nextFollowUpAt: { type: Date, index: true },
    /** Set when the status first moves to Converted, for reporting. */
    convertedAt: Date,
  },
  { timestamps: true },
)

export default mongoose.model('Lead', leadSchema)
