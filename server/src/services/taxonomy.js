import { HttpError } from '../middleware/error.js'
import { and, arrayContains, asc, count, eq, ne, sql } from 'drizzle-orm'
import { db, inParallel, withMongoId } from '../db/index.js'
import { isUuid } from '../db/coerce.js'
import { blogPosts, courses, programs, terms, workshops } from '../db/schema/index.js'

/** What the public may see. Was `VISIBLE_TERM` on the Mongoose model. */
export const VISIBLE_TERM = { status: 'Published', visibility: 'Public' }
const visibleTerm = and(eq(terms.status, 'Published'), eq(terms.visibility, 'Public'))

/**
 * Term registry operations: usage counting, renaming, merging and safe delete.
 *
 * Content documents store a term's canonical *name* rather than its id (see the
 * header of db/schema/content.js `terms` for why), so renaming or merging a term is a write
 * to the registry plus a reassignment across every collection that references
 * it. That reassignment is what this module owns — nothing else is allowed to
 * rewrite a term reference, so there is exactly one place where the two halves
 * can drift apart.
 */

/**
 * Where each taxonomy's terms are referenced from.
 *
 * `array: true` means the field holds many names and has to be updated with a
 * positional/pull operator rather than a plain $set.
 */
const ref = (table, name, field, array) => ({ table, name, field, array })
const TERM_REFERENCES = {
  topic: [ref(courses, 'Course', 'topic', false)],
  language: [
    ref(courses, 'Course', 'languages', true),
    ref(workshops, 'Workshop', 'language', false),
  ],
  'blog-category': [ref(blogPosts, 'BlogPost', 'category', false)],
  'workshop-city': [ref(workshops, 'Workshop', 'venue', false)],
  category: [
    ref(courses, 'Course', 'categories', true),
    ref(blogPosts, 'BlogPost', 'categories', true),
    ref(workshops, 'Workshop', 'categories', true),
    ref(programs, 'Program', 'categories', true),
  ],
  tag: [
    ref(courses, 'Course', 'tags', true),
    ref(blogPosts, 'BlogPost', 'tags', true),
    ref(workshops, 'Workshop', 'tags', true),
    ref(programs, 'Program', 'tags', true),
  ],
}

/** Rows whose `ref.field` mentions `name` — membership for arrays, equality otherwise. */
const mentions = (r, name) =>
  r.array ? arrayContains(r.table[r.field], [name]) : eq(r.table[r.field], name)

const MAX_DEPTH = 3

export function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** A slug unique within its taxonomy, suffixing -2, -3… only on collision. */
export async function uniqueSlug(taxonomy, desired, excludeId = null) {
  const base = slugify(desired) || 'term'
  for (let n = 1; n < 50; n += 1) {
    const candidate = n === 1 ? base : `${base}-${n}`
    const [clash] = await db
      .select({ id: terms.id })
      .from(terms)
      .where(
        and(
          eq(terms.taxonomy, taxonomy),
          eq(terms.slug, candidate),
          ...(isUuid(excludeId) ? [ne(terms.id, excludeId)] : []),
        ),
      )
    if (!clash) return candidate
  }
  throw new HttpError(409, 'Could not derive a unique slug')
}

/** How many documents currently reference this term, per collection. */
export async function countTermUsage(term) {
  const refs = TERM_REFERENCES[term.taxonomy] || []
  const counts = await Promise.all(
    refs.map(async (r) => {
      const [{ n }] = await db.select({ n: count() }).from(r.table).where(mentions(r, term.name))
      return { collection: r.name, field: r.field, count: n }
    }),
  )
  return { total: counts.reduce((sum, c) => sum + c.count, 0), byCollection: counts }
}

/** Usage totals for many terms at once, so the admin list is one round trip. */
export async function usageMap(terms) {
  const entries = await Promise.all(
    terms.map(async (t) => [String(t._id), (await countTermUsage(t)).total]),
  )
  return Object.fromEntries(entries)
}

/**
 * Repoints every reference from one term name to another.
 *
 * `toName === null` removes the reference instead: the array variants pull the
 * value out, the scalar variants unset the field. Returns the number of
 * documents touched.
 */
export async function reassignReferences(taxonomy, fromName, toName, { tx = db } = {}) {
  if (fromName === toName) return 0
  const refs = TERM_REFERENCES[taxonomy] || []
  let touched = 0

  for (const r of refs) {
    const column = r.table[r.field]
    let rows
    if (r.array) {
      // array_remove then append-if-absent, rather than array_replace: a row may
      // already carry the target name, and a blind rename would leave a
      // duplicate in the array.
      const next =
        toName === null
          ? sql`array_remove(${column}, ${fromName})`
          : sql`case when ${column} @> array[${toName}]::text[]
                  then array_remove(${column}, ${fromName})
                  else array_replace(${column}, ${fromName}, ${toName}) end`
      rows = await tx
        .update(r.table)
        .set({ [r.field]: next })
        .where(mentions(r, fromName))
        .returning({ id: r.table.id })
    } else {
      rows = await tx
        .update(r.table)
        .set({ [r.field]: toName })
        .where(mentions(r, fromName))
        .returning({ id: r.table.id })
    }
    touched += rows.length
  }
  return touched
}

const findTerm = async (id, tx = db) => {
  if (!isUuid(String(id))) return null
  const [row] = await tx
    .select()
    .from(terms)
    .where(eq(terms.id, String(id)))
  return row || null
}

/** Refuses a parent that would make the tree cyclic or too deep. */
export async function assertValidParent(termId, parentId) {
  if (!parentId) return
  if (termId && String(parentId) === String(termId)) {
    throw new HttpError(400, 'A term cannot be its own parent')
  }

  let depth = 1
  let cursor = await findTerm(parentId)
  if (!cursor) throw new HttpError(400, 'Parent term not found')

  while (cursor?.parent) {
    if (termId && String(cursor.parent) === String(termId)) {
      throw new HttpError(400, 'That parent would create a loop')
    }
    depth += 1
    if (depth > MAX_DEPTH) {
      throw new HttpError(400, `Categories can nest at most ${MAX_DEPTH} levels deep`)
    }
    cursor = await findTerm(cursor.parent)
  }
}

/**
 * Merges `source` into `target`: every reference repoints, the source's slug is
 * preserved on the target so old URLs keep resolving, and the source is removed.
 */
export async function mergeTerms(sourceId, targetId) {
  if (String(sourceId) === String(targetId)) {
    throw new HttpError(400, 'Pick two different terms to merge')
  }
  return db.transaction(async (tx) => {
    const [source, target] = await inParallel(tx, [
      () => findTerm(sourceId, tx),
      () => findTerm(targetId, tx),
    ])
    if (!source) throw new HttpError(404, 'Term to merge from not found')
    if (!target) throw new HttpError(404, 'Term to merge into not found')
    if (source.taxonomy !== target.taxonomy) {
      throw new HttpError(400, 'Terms from different taxonomies cannot be merged')
    }

    const moved = await reassignReferences(source.taxonomy, source.name, target.name, { tx })

    // Children follow their parent rather than being orphaned.
    await tx.update(terms).set({ parent: target.id }).where(eq(terms.parent, source.id))

    const inherited = [source.slug, ...(source.formerSlugs || [])]
    const formerSlugs = [...new Set([...(target.formerSlugs || []), ...inherited])].filter(
      (s) => s !== target.slug,
    )
    // Source goes first: its slug is about to live on in the target's formerSlugs.
    await tx.delete(terms).where(eq(terms.id, source.id))
    const [updated] = await tx
      .update(terms)
      .set({ formerSlugs })
      .where(eq(terms.id, target.id))
      .returning()

    return { moved, target: withMongoId(updated) }
  })
}

/**
 * Terms the public site may render, grouped by taxonomy and ordered.
 *
 * Shape is deliberately flat and small — it is served to every visitor as part
 * of GET /api/config, so it carries display fields only, never counts or
 * timestamps.
 */
export async function publicTermGroups() {
  const rows = await db
    .select()
    .from(terms)
    .where(visibleTerm)
    .orderBy(asc(terms.order), asc(terms.name))

  const groups = {}
  for (const t of rows) {
    ;(groups[t.taxonomy] ||= []).push({
      name: t.name,
      shortLabel: t.shortLabel || '',
      slug: t.slug,
      parent: t.parent ? String(t.parent) : null,
      id: String(t.id),
      icon: t.icon,
      color: t.color,
      thumbClass: t.thumbClass,
      description: t.description,
      showInMenu: t.showInMenu,
      showInFilters: t.showInFilters,
      showOnCards: t.showOnCards,
      featured: t.featured,
      showAsRail: t.showAsRail,
      linkTo: t.linkTo,
    })
  }
  return groups
}

/**
 * One visible (Published, Public) term of `taxonomy` by its exact name, with
 * its stored `seo` JSON, or null. Content references terms by name, and the
 * course category page's `?topic=` carries that name, so the match is exact —
 * the same comparison the catalogue filter makes.
 */
export async function findPublicTermByName(taxonomy, name) {
  const value = String(name ?? '').trim()
  if (!value) return null
  const [term] = await db
    .select()
    .from(terms)
    .where(and(eq(terms.taxonomy, taxonomy), eq(terms.name, value), visibleTerm))
  return term || null
}

export { TERM_REFERENCES, MAX_DEPTH }
