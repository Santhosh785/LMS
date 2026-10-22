import mongoose from 'mongoose'

/**
 * A mentor playbook — /resources/playbooks, new in the 2026 redesign.
 *
 * Stored rather than hard-coded because these are marketing content the team
 * will add to: a new cohort produces a new playbook, and that should not need
 * a deploy. Seeded from the six pages in the redesign drop.
 */
const playbookSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, index: true },
    /** Short title used on the index card, which is punchier than the H1. */
    cardTitle: String,
    /** Discipline label on the card and the detail hero, e.g. "SEO". */
    tag: { type: String, index: true },
    deck: String,
    /** Card summary on the index page. */
    summary: String,

    /** Gradient classes from the drop: .pb-v-* on the card, .pb-hero-* on the hero. */
    visualClass: { type: String, default: 'pb-v-seo' },
    heroClass: { type: String, default: 'pb-hero-seo' },

    authorName: String,
    authorRole: String,
    initials: String,

    achievement: { heading: String, body: String },
    /**
     * The body of the playbook. `id` is the anchor the sidebar contents links
     * to, so the table of contents is generated rather than stored twice.
     */
    sections: [
      {
        id: { type: String, required: true },
        heading: String,
        body: [String],
        items: [String],
      },
    ],
    tools: String,
    /** Cross-link to the Claude skill that automates part of this playbook. */
    relatedSkill: { label: String, slug: String },
    cta: { heading: String, body: String },

    order: { type: Number, default: 0 },
    status: { type: String, enum: ['Published', 'Draft'], default: 'Published', index: true },
  },
  { timestamps: true },
)

export default mongoose.model('Playbook', playbookSchema)
