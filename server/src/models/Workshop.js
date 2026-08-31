import mongoose from 'mongoose'

const workshopSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true, lowercase: true, index: true },
    mode: { type: String, enum: ['online', 'offline'], default: 'online', index: true },
    language: { type: String, index: true },
    // Governed by the Term registry — see models/Term.js.
    categories: { type: [String], index: true, default: [] },
    tags: { type: [String], index: true, default: [] },
    level: String,
    bannerTitle: String,
    /**
     * Optional cover image. The design ships with a coloured gradient
     * (`bannerClass`) and the title drawn over it, carried over from the static
     * site — that stays the fallback, so leaving this empty changes nothing and
     * a broken URL degrades to the gradient rather than a broken-image icon.
     */
    image: String,
    imageAlt: String,
    bannerClass: { type: String, default: 'ws-seo' },
    priceNew: { type: Number, default: 0 },
    priceOld: Number,
    startsAt: Date,
    durationLabel: String,
    venue: String,
    host: String,
    hostInitials: String,
    capacity: { type: Number, default: 100 },
    registeredCount: { type: Number, default: 0 },
    // landing-page content for /workshops/:slug
    landing: {
      headline: String,
      subhead: String,
      bullets: [String],
      agenda: [{ time: String, title: String, body: String }],
      faqs: [{ q: String, a: String }],
      quotes: [{ quote: String, author: String }],
    },
  },
  { timestamps: true },
)

export default mongoose.model('Workshop', workshopSchema)
