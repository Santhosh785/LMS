import mongoose from 'mongoose'

const programSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true, lowercase: true, index: true },
    eyebrow: String,
    description: String,
    // Governed by the Term registry — see models/Term.js. Lets a program sit in
    // a homepage showcase rail alongside courses.
    categories: { type: [String], index: true, default: [] },
    tags: { type: [String], index: true, default: [] },
    weeks: { type: Number, default: 12 },
    meta: [String],
    heroImage: String,
    outcomes: [{ title: String, body: String, phase: String }],
    stats: [{ value: String, label: String }],
    comparison: {
      theirs: { title: String, points: [String] },
      ours: { title: String, points: [String] },
    },
    curriculum: [{ week: String, title: String, points: [String], output: String }],
    audience: [{ step: String, title: String, body: String }],
    admission: [{ title: String, body: String }],
    mentors: [{ name: String, role: String, initials: String }],
    testimonials: [{ quote: String, author: String, location: String }],
    faqs: [{ q: String, a: String }],

    /*
     * The program page's own furniture: the eyebrow, heading and subhead above
     * each section, and the button labels. All of it was hardcoded in
     * ProgramDetail.jsx, so "Apply Now" or "Not a certificate factory" could
     * only be changed by a developer. Addressed by `key` rather than named
     * fields so the admin editor renders one repeatable list and a new section
     * needs no schema change.
     *
     * Anything absent falls back to the wording the page shipped with.
     */
    sectionCopy: [
      {
        key: { type: String, required: true },
        eyebrow: String,
        heading: String,
        subhead: String,
      },
    ],
    /** Button labels and destinations, addressed by key. */
    ctas: [{ key: { type: String, required: true }, label: String, to: String }],
    /** Column headings for the outcomes grid, matched against `outcomes[].phase`. */
    phaseLabels: [String],

    pricing: {
      amount: Number,
      strikeAmount: Number,
      note: String,
      benefits: [String],
    },
  },
  { timestamps: true },
)

export default mongoose.model('Program', programSchema)
