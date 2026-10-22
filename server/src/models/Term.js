import mongoose from 'mongoose'

/**
 * One term of one taxonomy — a category, a tag, a topic, a language, a city.
 *
 * Before this model the catalogue's classification lived in two places that
 * could not be edited: unvalidated free-text on the content documents
 * (`Course.topic`, `BlogPost.category`), and a hardcoded `filterGroups` array
 * in the client. A typo silently created a new topic, and nothing could be
 * renamed, reordered or hidden without a deploy.
 *
 * ## Why content documents still store the term's *name*, not its id
 *
 * The catalogue's URL contract is `?topic=SEO&lang=Tamil` and is depended on by
 * existing links, the money path and the seeded content. Switching the content
 * documents to ObjectId references would change every catalogue URL to opaque
 * ids and force a migration of every course, post and workshop.
 *
 * So this model is a *registry*: it owns what terms exist, how they are
 * spelled, ordered, coloured and whether they are shown, while the content
 * documents keep storing the canonical name. Renaming a term is therefore a
 * write here plus a reassignment across the referencing collections, which is
 * exactly the operation TAX-4 requires anyway — see services/taxonomy.js.
 */

/** Which taxonomies exist, and where each one's terms are referenced from. */
export const TAXONOMIES = ['category', 'tag', 'topic', 'language', 'blog-category', 'workshop-city']

const termSchema = new mongoose.Schema(
  {
    taxonomy: { type: String, enum: TAXONOMIES, required: true, index: true },

    name: { type: String, required: true, trim: true },
    /**
     * Optional abbreviation for tight spaces — the homepage career pills show
     * "Social Ads" where the term is "Social Advertising". That shortening used
     * to be a hardcoded `pill === 'Social Advertising' ? 'Social Ads'` ladder in
     * Home.jsx, so a renamed topic silently kept the old abbreviation.
     */
    shortLabel: { type: String, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true, index: true },
    description: String,

    /** Hierarchy. Root terms have no parent; depth is capped in the service. */
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Term', default: null, index: true },

    // presentation
    icon: String,
    color: String,
    /** One of the decorative gradient classes in client/src/index.css. */
    thumbClass: String,

    /** Explicit ordering — admin drags to reorder rather than relying on name. */
    order: { type: Number, default: 0, index: true },

    /*
     * Visibility is deliberately per-surface rather than one boolean: an
     * operator routinely wants a term to stay filterable while dropping out of
     * the header menu, or to exist for internal tagging and appear nowhere.
     */
    showInMenu: { type: Boolean, default: false },
    showInFilters: { type: Boolean, default: true },
    showOnCards: { type: Boolean, default: true },
    featured: { type: Boolean, default: false, index: true },

    /*
     * Homepage showcase rails. The "New and popular" strip used to be three
     * hardcoded lists of course slugs; a tag flagged here becomes one rail,
     * headed by the term's name and filled with whatever carries the tag. So
     * curating the homepage is tagging a course, not editing Home.jsx.
     */
    showAsRail: { type: Boolean, default: false, index: true },
    /** Where the rail heading links. Defaults to the tag's own archive. */
    linkTo: String,

    // Same vocabulary as Course, so every entity reads the same way.
    status: {
      type: String,
      enum: ['Published', 'Draft', 'Archived'],
      default: 'Published',
      index: true,
    },
    visibility: { type: String, enum: ['Public', 'Hidden'], default: 'Public' },

    seo: {
      metaTitle: String,
      metaDescription: String,
      ogImage: String,
    },

    /**
     * Slugs this term used to answer to, so a rename does not break inbound
     * links, and a merged-away term keeps resolving to its winner.
     */
    formerSlugs: [{ type: String, lowercase: true, index: true }],
  },
  { timestamps: true },
)

// A slug identifies a term within its own taxonomy — "seo" may legitimately be
// both a course topic and a blog category.
termSchema.index({ taxonomy: 1, slug: 1 }, { unique: true })
termSchema.index({ taxonomy: 1, order: 1, name: 1 })

/** The filter that decides whether the public site may render a term. */
export const VISIBLE_TERM = { status: 'Published', visibility: 'Public' }

export default mongoose.model('Term', termSchema)
