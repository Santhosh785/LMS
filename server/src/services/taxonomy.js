import { HttpError } from '../middleware/error.js'
import Term, { VISIBLE_TERM } from '../models/Term.js'
import { Course, BlogPost, Workshop, Program } from '../models/index.js'

/**
 * Term registry operations: usage counting, renaming, merging and safe delete.
 *
 * Content documents store a term's canonical *name* rather than its id (see the
 * header of models/Term.js for why), so renaming or merging a term is a write
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
const TERM_REFERENCES = {
  topic: [{ model: Course, field: 'topic', array: false }],
  language: [
    { model: Course, field: 'languages', array: true },
    { model: Workshop, field: 'language', array: false },
  ],
  'blog-category': [{ model: BlogPost, field: 'category', array: false }],
  'workshop-city': [{ model: Workshop, field: 'venue', array: false }],
  category: [
    { model: Course, field: 'categories', array: true },
    { model: BlogPost, field: 'categories', array: true },
    { model: Workshop, field: 'categories', array: true },
    { model: Program, field: 'categories', array: true },
  ],
  tag: [
    { model: Course, field: 'tags', array: true },
    { model: BlogPost, field: 'tags', array: true },
    { model: Workshop, field: 'tags', array: true },
    { model: Program, field: 'tags', array: true },
  ],
}

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
    const clash = await Term.findOne({
      taxonomy,
      slug: candidate,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    }).lean()
    if (!clash) return candidate
  }
  throw new HttpError(409, 'Could not derive a unique slug')
}

/** How many documents currently reference this term, per collection. */
export async function countTermUsage(term) {
  const refs = TERM_REFERENCES[term.taxonomy] || []
  const counts = await Promise.all(
    refs.map(async (ref) => ({
      collection: ref.model.modelName,
      field: ref.field,
      count: await ref.model.countDocuments({ [ref.field]: term.name }),
    })),
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
export async function reassignReferences(taxonomy, fromName, toName) {
  if (fromName === toName) return 0
  const refs = TERM_REFERENCES[taxonomy] || []
  let touched = 0

  for (const ref of refs) {
    if (ref.array) {
      if (toName === null) {
        const res = await ref.model.updateMany(
          { [ref.field]: fromName },
          { $pull: { [ref.field]: fromName } },
        )
        touched += res.modifiedCount || 0
      } else {
        // Two steps rather than one $set on the positional operator: a document
        // may already carry the target name, and a blind rename would leave a
        // duplicate in the array.
        const renamed = await ref.model.updateMany(
          { [ref.field]: fromName, $nor: [{ [ref.field]: toName }] },
          { $set: { [`${ref.field}.$[el]`]: toName } },
          { arrayFilters: [{ el: fromName }] },
        )
        const deduped = await ref.model.updateMany(
          { [ref.field]: fromName },
          { $pull: { [ref.field]: fromName } },
        )
        touched += (renamed.modifiedCount || 0) + (deduped.modifiedCount || 0)
      }
    } else {
      const update =
        toName === null ? { $unset: { [ref.field]: '' } } : { $set: { [ref.field]: toName } }
      const res = await ref.model.updateMany({ [ref.field]: fromName }, update)
      touched += res.modifiedCount || 0
    }
  }
  return touched
}

/** Refuses a parent that would make the tree cyclic or too deep. */
export async function assertValidParent(termId, parentId) {
  if (!parentId) return
  if (termId && String(parentId) === String(termId)) {
    throw new HttpError(400, 'A term cannot be its own parent')
  }

  let depth = 1
  let cursor = await Term.findById(parentId).lean()
  if (!cursor) throw new HttpError(400, 'Parent term not found')

  while (cursor?.parent) {
    if (termId && String(cursor.parent) === String(termId)) {
      throw new HttpError(400, 'That parent would create a loop')
    }
    depth += 1
    if (depth > MAX_DEPTH) {
      throw new HttpError(400, `Categories can nest at most ${MAX_DEPTH} levels deep`)
    }
    cursor = await Term.findById(cursor.parent).lean()
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
  const [source, target] = await Promise.all([Term.findById(sourceId), Term.findById(targetId)])
  if (!source) throw new HttpError(404, 'Term to merge from not found')
  if (!target) throw new HttpError(404, 'Term to merge into not found')
  if (source.taxonomy !== target.taxonomy) {
    throw new HttpError(400, 'Terms from different taxonomies cannot be merged')
  }

  const moved = await reassignReferences(source.taxonomy, source.name, target.name)

  // Children follow their parent rather than being orphaned.
  await Term.updateMany({ parent: source._id }, { $set: { parent: target._id } })

  const inherited = [source.slug, ...(source.formerSlugs || [])]
  target.formerSlugs = [...new Set([...(target.formerSlugs || []), ...inherited])].filter(
    (s) => s !== target.slug,
  )
  await target.save()
  await source.deleteOne()

  return { moved, target }
}

/**
 * Terms the public site may render, grouped by taxonomy and ordered.
 *
 * Shape is deliberately flat and small — it is served to every visitor as part
 * of GET /api/config, so it carries display fields only, never counts or
 * timestamps.
 */
export async function publicTermGroups() {
  const terms = await Term.find(VISIBLE_TERM)
    .sort({ order: 1, name: 1 })
    .select(
      'taxonomy name shortLabel slug parent icon color thumbClass showInMenu showInFilters showOnCards featured showAsRail linkTo description',
    )
    .lean()

  const groups = {}
  for (const t of terms) {
    ;(groups[t.taxonomy] ||= []).push({
      name: t.name,
      shortLabel: t.shortLabel || '',
      slug: t.slug,
      parent: t.parent ? String(t.parent) : null,
      id: String(t._id),
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

export { TERM_REFERENCES, MAX_DEPTH }
