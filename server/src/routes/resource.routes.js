import { Router } from 'express'
import { asyncHandler, HttpError } from '../middleware/error.js'
import { body } from 'express-validator'
import { validate } from '../middleware/validate.js'
import { and, asc, count, eq, isNotNull, sql } from 'drizzle-orm'
import { db, withMongoId } from '../db/index.js'
import { claudeSkills, emailContacts, playbooks } from '../db/schema/index.js'
import { pickColumns } from '../db/repos/content.js'

const router = Router()

/**
 * The public Resources section: mentor playbooks and Claude skills.
 *
 * Reads only. Drafts never leave the admin, so an unfinished playbook cannot
 * be reached by guessing its slug.
 */

const published = (table) => eq(table.status, 'Published')

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
    const where = and(
      published(playbooks),
      req.query.tag ? eq(playbooks.tag, String(req.query.tag)) : undefined,
    )

    const [items, tags] = await Promise.all([
      db
        .select(pickColumns(playbooks, PLAYBOOK_CARD))
        .from(playbooks)
        .where(where)
        .orderBy(asc(playbooks.order), asc(playbooks.title)),
      db
        .selectDistinct({ tag: playbooks.tag })
        .from(playbooks)
        .where(and(published(playbooks), isNotNull(playbooks.tag))),
    ])
    res.json({
      items: withMongoId(items),
      tags: tags
        .map((t) => t.tag)
        .filter(Boolean)
        .sort(),
    })
  }),
)

router.get(
  '/playbooks/:slug',
  asyncHandler(async (req, res) => {
    const [row] = await db
      .select()
      .from(playbooks)
      .where(and(eq(playbooks.slug, String(req.params.slug).toLowerCase()), published(playbooks)))
    if (!row) throw new HttpError(404, 'Playbook not found')
    const playbook = withMongoId(row)

    // The sidebar cross-links to a skill; resolve it so a renamed or
    // unpublished skill degrades to no link rather than a dead one.
    let relatedSkill = null
    if (playbook.relatedSkill?.slug) {
      const [skill] = await db
        .select(pickColumns(claudeSkills, 'title slug'))
        .from(claudeSkills)
        .where(and(eq(claudeSkills.slug, playbook.relatedSkill.slug), published(claudeSkills)))
      relatedSkill = skill ? withMongoId(skill) : null
    }
    res.json({
      ...playbook,
      relatedSkill: relatedSkill ? { ...playbook.relatedSkill, ...relatedSkill } : null,
    })
  }),
)

router.get(
  '/skills',
  asyncHandler(async (req, res) => {
    const where = and(
      published(claudeSkills),
      req.query.category ? eq(claudeSkills.category, String(req.query.category)) : undefined,
    )

    const [items, categories] = await Promise.all([
      db
        .select(pickColumns(claudeSkills, SKILL_CARD))
        .from(claudeSkills)
        .where(where)
        .orderBy(asc(claudeSkills.order), asc(claudeSkills.title)),
      // The filter row is built from what exists, so an empty category cannot
      // render a tab that matches nothing.
      db
        .select({ category: claudeSkills.category, count: count() })
        .from(claudeSkills)
        .where(published(claudeSkills))
        .groupBy(claudeSkills.category)
        .orderBy(asc(claudeSkills.category)),
    ])

    res.json({
      items: withMongoId(items),
      categories: categories
        .filter((c) => c.category)
        .map((c) => ({
          value: c.category,
          label: SKILL_FILTER_LABELS[c.category] || c.category,
          count: c.count,
        })),
    })
  }),
)

router.get(
  '/skills/:slug',
  asyncHandler(async (req, res) => {
    const [skill] = await db
      .select()
      .from(claudeSkills)
      .where(
        and(eq(claudeSkills.slug, String(req.params.slug).toLowerCase()), published(claudeSkills)),
      )
    if (!skill) throw new HttpError(404, 'Skill not found')
    res.json(withMongoId(skill))
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
 * until that flag is on. They are in the `email_contacts` table meanwhile.
 */
router.post(
  '/notify',
  body('email').isEmail().withMessage('Enter a valid email').normalizeEmail(),
  validate,
  asyncHandler(async (req, res) => {
    // email has no unique constraint (a contact list may legitimately hold
    // imports with duplicates), so the upsert is an update-then-insert.
    const updated = await db
      .update(emailContacts)
      .set({ status: 'Subscribed' })
      .where(sql`${emailContacts.email} = ${req.body.email}`)
      .returning({ id: emailContacts.id })
    if (!updated.length) {
      await db.insert(emailContacts).values({ email: req.body.email, status: 'Subscribed' })
    }
    res.status(201).json({ ok: true })
  }),
)

export default router
