import mongoose from 'mongoose'

/**
 * A reusable Claude skill — /resources/claude-skills, new in the 2026 redesign.
 *
 * `category` drives the filter row on the index and is the machine key ("seo");
 * `badge` is what a reader sees ("SEO"). They are stored separately because the
 * drop's filter buttons match on the key while the card shows the label.
 */
const claudeSkillSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, index: true },
    cardTitle: String,
    tagline: String,
    /** Card summary on the index page. */
    summary: String,
    about: String,

    category: { type: String, index: true },
    badge: String,
    icon: { type: String, default: '✦' },

    /** "What it does" — the four-up grid on the detail page. */
    features: [{ title: String, body: String }],

    worksWith: { type: String, default: 'Claude' },
    /** Shown as the "Status" row; not the publishing status below. */
    readiness: { type: String, default: 'Ready' },

    order: { type: Number, default: 0 },
    status: { type: String, enum: ['Published', 'Draft'], default: 'Published', index: true },
  },
  { timestamps: true },
)

export default mongoose.model('ClaudeSkill', claudeSkillSchema)
