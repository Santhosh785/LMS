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
    /** `image` is a public URL (e.g. /assets/flagship/who-01.jpg), so it is swappable without a build. */
    audience: [{ step: String, title: String, body: String, image: String, imageAlt: String }],

    /* ----------------------- 2026 redesign additions ----------------------- */
    /**
     * Seven sections the redesigned flagship page adds. All optional: a program
     * that has not been given one simply does not render that section, so the
     * other programs in the collection keep working untouched.
     */

    /** Scarcity line repeated in the hero, the pricing panel and the sticky bar. */
    batchNote: String,
    /** The four figures in the bar directly under the hero. */
    trustBar: [{ value: String, label: String }],
    /** "The Why behind the program" — prose, a brochure link and a photograph. */
    why: {
      paragraphs: [String],
      brochureUrl: String,
      brochureLabel: String,
      image: String,
      imageAlt: String,
    },
    /**
     * The Common-Core-then-track comparison table. `values` lines up with
     * `columns`; a row with one value spans them, which is how the shared
     * Common Core row is drawn.
     */
    structure: {
      columns: [String],
      rows: [{ stage: String, values: [String], isTotal: Boolean }],
    },
    /** The two post-Common-Core tracks. */
    tracks: [
      {
        tag: String,
        title: String,
        goal: String,
        variant: String,
        modules: [{ code: String, body: String }],
        milestone: String,
      },
    ],
    /** "Recommended tools", grouped by discipline. */
    toolGroups: [{ title: String, items: [String] }],
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
      /* --- 2026 redesign: the fuller pricing panel --- */
      /** ISO code shown before the amount ("INR"). */
      currency: String,
      /** Tax wording after the figure, e.g. "/– (inc. tax)". */
      taxNote: String,
      scholarship: String,
      duration: String,
      status: String,
      slots: String,
      /** "What your fee is actually funding" — the list beside the price. */
      funding: [{ title: String, body: String }],
    },
  },
  { timestamps: true },
)

export default mongoose.model('Program', programSchema)
