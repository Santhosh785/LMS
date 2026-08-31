import mongoose from 'mongoose'

const blogPostSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true, lowercase: true, index: true },
    category: { type: String, index: true },
    // Governed by the Term registry — see models/Term.js.
    categories: { type: [String], index: true, default: [] },
    tags: { type: [String], index: true, default: [] },
    excerpt: String,
    // body blocks keep the original article structure (headings, paragraphs, lists, quotes)
    body: [
      {
        type: {
          type: String,
          enum: ['h2', 'h3', 'p', 'ul', 'ol', 'quote', 'callout'],
          default: 'p',
        },
        text: String,
        items: [String],
      },
    ],
    author: { name: String, avatar: String, role: String },
    publishedAt: { type: Date, default: Date.now, index: true },
    readTime: String,
    featured: { type: Boolean, default: false, index: true },
    /**
     * Optional cover image. The design ships with a coloured gradient
     * (`heroClass`) and the title drawn over it, carried over from the static
     * site — that stays the fallback, so leaving this empty changes nothing and
     * a broken URL degrades to the gradient rather than a broken-image icon.
     */
    image: String,
    imageAlt: String,
    heroClass: { type: String, default: 'feat-seo' },
    heroLabel: String,
  },
  { timestamps: true },
)

export default mongoose.model('BlogPost', blogPostSchema)
