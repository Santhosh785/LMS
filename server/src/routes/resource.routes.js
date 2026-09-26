import { Router } from 'express'
import { asyncHandler, HttpError } from '../middleware/error.js'
import { body } from 'express-validator'
import { validate } from '../middleware/validate.js'
import { ClaudeSkill, EmailContact, Playbook } from '../models/index.js'

const router = Router()

/**
 * The public Resources section: mentor playbooks and Claude skills.
 *
 * Reads only. Drafts never leave the admin, so an unfinished playbook cannot
 * be reached by guessing its slug.
 */

const PUBLISHED = { status: 'Published' }

/**
 * The filter row's labels, from the drop's markup. They are not the card
 * badges: two skills share `category: "analytics"` but badge themselves
 * "Analytics" and "AI", and the drop calls the `ads` filter "Paid media".
 * Grouping on the badge would therefore split one tab into two.
 */
const SKILL_FILTER_LABELS = {
  seo: 'SEO',
  ads: 'Paid media',
  copy: 'Copy',
  funnel: 'Funnels',
  analytics: 'Analytics',
}

/** The index cards need none of the body, and these documents are large. */
const PLAYBOOK_CARD =
  'title slug cardTitle tag summary visualClass authorName authorRole initials order'
const SKILL_CARD = 'title slug cardTitle summary category badge icon order'

router.get(
  '/playbooks',
  asyncHandler(async (req, res) => {
    const filter = { ...PUBLISHED }
    if (req.query.tag) filter.tag = req.query.tag

    const [items, tags] = await Promise.all([
      Playbook.find(filter).select(PLAYBOOK_CARD).sort({ order: 1, title: 1 }).lean(),
      Playbook.distinct('tag', PUBLISHED),
    ])
    res.json({ items, tags: tags.filter(Boolean).sort() })
  }),
)

router.get(
  '/playbooks/:slug',
  asyncHandler(async (req, res) => {
    const playbook = await Playbook.findOne({ slug: req.params.slug, ...PUBLISHED }).lean()
    if (!playbook) throw new HttpError(404, 'Playbook not found')

    // The sidebar cross-links to a skill; resolve it so a renamed or
    // unpublished skill degrades to no link rather than a dead one.
    let relatedSkill = null
    if (playbook.relatedSkill?.slug) {
      relatedSkill = await ClaudeSkill.findOne({
        slug: playbook.relatedSkill.slug,
        ...PUBLISHED,
      })
        .select('title slug')
        .lean()
    }
    res.json({ ...playbook, relatedSkill: relatedSkill ? { ...playbook.relatedSkill, ...relatedSkill } : null })
  }),
)

router.get(
  '/skills',
  asyncHandler(async (req, res) => {
    const filter = { ...PUBLISHED }
    if (req.query.category) filter.category = req.query.category

    const [items, categories] = await Promise.all([
      ClaudeSkill.find(filter).select(SKILL_CARD).sort({ order: 1, title: 1 }).lean(),
      // The filter row is built from what exists, so an empty category cannot
      // render a tab that matches nothing.
      ClaudeSkill.aggregate([
        { $match: PUBLISHED },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
    ])

    res.json({
      items,
      categories: categories
        .filter((c) => c._id)
        .map((c) => ({ value: c._id, label: SKILL_FILTER_LABELS[c._id] || c._id, count: c.count })),
    })
  }),
)

router.get(
  '/skills/:slug',
  asyncHandler(async (req, res) => {
    const skill = await ClaudeSkill.findOne({ slug: req.params.slug, ...PUBLISHED }).lean()
    if (!skill) throw new HttpError(404, 'Skill not found')
    res.json(skill)
  }),
)

/**
 * "Get notified when a new playbook drops" on the index page.
 *
 * Stored as an EmailContact, the model built for exactly this. Idempotent on
 * email: re-submitting re-subscribes rather than creating a duplicate, so a
 * double-tap cannot inflate the list.
 *
 * Note for whoever wires the sending side: the Email admin module is behind
 * FEATURE_EMAIL, so these addresses are captured but not browsable in the UI
 * until that flag is on. They are in the `emailcontacts` collection meanwhile.
 */
router.post(
  '/notify',
  body('email').isEmail().withMessage('Enter a valid email').normalizeEmail(),
  validate,
  asyncHandler(async (req, res) => {
    await EmailContact.findOneAndUpdate(
      { email: req.body.email },
      { $set: { status: 'Subscribed' }, $setOnInsert: { joinedAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )
    res.status(201).json({ ok: true })
  }),
)

export default router
