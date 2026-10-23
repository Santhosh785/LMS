import { and, asc, count, eq, isNotNull } from 'drizzle-orm'
import { db, withMongoId } from '../index.js'
import { claudeSkills, playbooks } from '../schema/index.js'
import { pickColumns } from './content.js'

/**
 * The public Resources section: mentor playbooks and Claude skills.
 *
 * Published rows only. Drafts never leave the admin, so an unfinished
 * playbook cannot be reached by guessing its slug. Both the JSON API
 * (routes/resource.routes.js) and the server-rendered pages read through
 * here, so the two can never disagree about what is public.
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

/**
 * The playbook index: `{ items, tags }`, cards in the operator's order.
 * @param {{ tag?: string }} [filter]
 */
export async function listPublishedPlaybooks({ tag } = {}) {
  const where = and(published(playbooks), tag ? eq(playbooks.tag, String(tag)) : undefined)

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
  return {
    items: withMongoId(items),
    tags: tags
      .map((t) => t.tag)
      .filter(Boolean)
      .sort(),
  }
}

/**
 * One published playbook by slug, or null. The sidebar cross-links to a
 * skill; it is resolved here so a renamed or unpublished skill degrades to no
 * link rather than a dead one.
 */
export async function findPublishedPlaybook(slug) {
  const [row] = await db
    .select()
    .from(playbooks)
    .where(and(eq(playbooks.slug, String(slug).toLowerCase()), published(playbooks)))
  if (!row) return null
  const playbook = withMongoId(row)

  let relatedSkill = null
  if (playbook.relatedSkill?.slug) {
    const [skill] = await db
      .select(pickColumns(claudeSkills, 'title slug'))
      .from(claudeSkills)
      .where(and(eq(claudeSkills.slug, playbook.relatedSkill.slug), published(claudeSkills)))
    relatedSkill = skill ? withMongoId(skill) : null
  }
  return {
    ...playbook,
    relatedSkill: relatedSkill ? { ...playbook.relatedSkill, ...relatedSkill } : null,
  }
}

/**
 * The skills index: `{ items, categories }`. The filter row is built from what
 * exists, so an empty category cannot render a tab that matches nothing.
 * @param {{ category?: string }} [filter]
 */
export async function listPublishedSkills({ category } = {}) {
  const where = and(
    published(claudeSkills),
    category ? eq(claudeSkills.category, String(category)) : undefined,
  )

  const [items, categories] = await Promise.all([
    db
      .select(pickColumns(claudeSkills, SKILL_CARD))
      .from(claudeSkills)
      .where(where)
      .orderBy(asc(claudeSkills.order), asc(claudeSkills.title)),
    db
      .select({ category: claudeSkills.category, count: count() })
      .from(claudeSkills)
      .where(published(claudeSkills))
      .groupBy(claudeSkills.category)
      .orderBy(asc(claudeSkills.category)),
  ])

  return {
    items: withMongoId(items),
    categories: categories
      .filter((c) => c.category)
      .map((c) => ({
        value: c.category,
        label: SKILL_FILTER_LABELS[c.category] || c.category,
        count: c.count,
      })),
  }
}

/** One published skill by slug, or null. */
export async function findPublishedSkill(slug) {
  const [skill] = await db
    .select()
    .from(claudeSkills)
    .where(and(eq(claudeSkills.slug, String(slug).toLowerCase()), published(claudeSkills)))
  return skill ? withMongoId(skill) : null
}
