import mongoose from 'mongoose'

/** Every block type the editor can produce and the public renderer can draw. */
export const BLOCK_TYPES = [
  'p',
  'h2',
  'h3',
  'h4',
  'ul',
  'ol',
  'quote',
  'callout',
  'image',
  'code',
  'separator',
  'button',
  'embed',
  'table',
]

/**
 * One block of article content.
 *
 * Blocks carry named fields rather than a slab of HTML. That is the reason the
 * editor can look like Gutenberg while the public article stays safe to render:
 * nothing an editor types is ever handed to dangerouslySetInnerHTML. Inline
 * emphasis is expressed in the restricted `**bold** / *italic* / [text](url) /
 * \`code\`` syntax that client/src/lib/richText.jsx parses into React elements —
 * see that file for the grammar.
 */
const blockSchema = new mongoose.Schema(
  {
    type: { type: String, enum: BLOCK_TYPES, default: 'p' },
    text: String,
    items: [String],
    /** image / embed / button target */
    url: String,
    /**
     * The Media Library row this image came from.
     *
     * The URL alone is enough to render, but not enough to offer a Size
     * dropdown or to build a srcset — both need to know which derivatives
     * exist. Keeping the id means regenerating sizes flows through to every
     * post automatically, rather than baking today's URLs into the body.
     */
    mediaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Media' },
    /** The rendered dimensions of the chosen size, so the browser can reserve space. */
    width: Number,
    height: Number,
    alt: String,
    caption: String,
    /** quote attribution */
    citation: String,
    /** 'left' | 'center' | 'right' | 'wide' */
    align: String,
    /** code block language label, button style ('fill' | 'outline'), embed provider */
    language: String,
    style: String,
    provider: String,
    /** table rows, first row optionally a header */
    rows: [{ cells: [String] }],
    header: Boolean,
  },
  { _id: false },
)

const revisionSchema = new mongoose.Schema({
  title: String,
  slug: String,
  excerpt: String,
  body: mongoose.Schema.Types.Mixed,
  category: String,
  categories: [String],
  tags: [String],
  image: String,
  imageAlt: String,
  heroClass: String,
  heroLabel: String,
  featured: Boolean,
  status: String,
  publishedAt: Date,
  readTime: String,
  seo: mongoose.Schema.Types.Mixed,
  savedAt: { type: Date, default: Date.now },
  savedBy: String,
  /** WordPress distinguishes an autosave from a real revision in the list. */
  autosave: { type: Boolean, default: false },
})

const blogPostSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true, lowercase: true, index: true },
    category: { type: String, index: true },
    // Governed by the Term registry — see models/Term.js.
    categories: { type: [String], index: true, default: [] },
    tags: { type: [String], index: true, default: [] },
    excerpt: String,
    body: [blockSchema],
    author: { name: String, avatar: String, role: String },
    publishedAt: { type: Date, default: Date.now, index: true },
    readTime: String,
    /** Publishing is explicit: drafts, trashed and future-scheduled posts never
     * appear in the public archive, even when somebody knows their slug. */
    status: {
      type: String,
      enum: ['Draft', 'Pending', 'Published', 'Scheduled', 'Archived', 'Trash'],
      default: 'Draft',
      index: true,
    },
    /**
     * Trash is a two-step delete, as in WordPress: the row leaves every other
     * view but keeps the status it had, so Restore puts it back where it was
     * rather than dumping everything into Draft.
     */
    trashedAt: Date,
    statusBeforeTrash: String,

    /** Public, or readable only by an admin, or gated behind a shared password. */
    visibility: { type: String, enum: ['Public', 'Private', 'Password'], default: 'Public' },
    password: String,
    /** "Stick this post to the front of the blog" — the featured carousel. */
    featured: { type: Boolean, default: false, index: true },
    sticky: { type: Boolean, default: false },
    allowComments: { type: Boolean, default: false },
    /**
     * Optional cover image. The design ships with a coloured gradient
     * (`heroClass`) and the title drawn over it, carried over from the static
     * site — that stays the fallback, so leaving this empty changes nothing and
     * a broken URL degrades to the gradient rather than a broken-image icon.
     */
    image: String,
    imageAlt: String,
    /** Same purpose as a block's `mediaId`, for the cover image. */
    imageMediaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Media' },
    imageWidth: Number,
    imageHeight: Number,
    heroClass: { type: String, default: 'feat-seo' },
    heroLabel: String,
    seo: {
      metaTitle: String,
      metaDescription: String,
      canonicalUrl: String,
      ogImage: String,
      focusKeyword: String,
      noIndex: { type: Boolean, default: false },
    },
    /** Kept small and embedded so restoring an accidental overwrite is one
     * admin action, without needing a second collection or transaction. */
    revisions: [revisionSchema],
  },
  { timestamps: true },
)

blogPostSchema.index({ status: 1, publishedAt: -1 })
blogPostSchema.index({ title: 'text', excerpt: 'text' })

export default mongoose.model('BlogPost', blogPostSchema)
