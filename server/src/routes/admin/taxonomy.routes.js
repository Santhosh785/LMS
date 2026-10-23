import { Router } from 'express'
import { asyncHandler, HttpError } from '../../middleware/error.js'
import { and, asc, count, eq, ilike } from 'drizzle-orm'
import { db, withMongoId } from '../../db/index.js'
import { coerce, isUuid } from '../../db/coerce.js'
import { terms, TAXONOMIES } from '../../db/schema/index.js'
import {
  assertValidParent,
  countTermUsage,
  mergeTerms,
  reassignReferences,
  uniqueSlug,
  usageMap,
} from '../../services/taxonomy.js'
import { invalidateEverywhere } from '../../services/invalidation.js'

const router = Router()

/** Human labels for the taxonomy switcher, and whether the set is hierarchical. */
const TAXONOMY_META = {
  category: {
    label: 'Categories',
    hierarchical: true,
    help: 'Cross-content grouping for courses, posts and workshops.',
  },
  tag: { label: 'Tags', hierarchical: false, help: 'Flat keywords. Many per item.' },
  topic: {
    label: 'Course topics',
    hierarchical: false,
    help: 'The catalogue’s primary filter facet.',
  },
  language: {
    label: 'Languages',
    hierarchical: false,
    help: 'Course and workshop delivery languages.',
  },
  'blog-category': { label: 'Blog categories', hierarchical: false, help: 'The blog sidebar.' },
  'workshop-city': {
    label: 'Workshop cities',
    hierarchical: false,
    help: 'Offline workshop locations.',
  },
}

/** Fields a client may write. Anything else on the body is ignored. */
const WRITABLE = [
  'name',
  'shortLabel',
  'description',
  'parent',
  'icon',
  'color',
  'thumbClass',
  'order',
  'showInMenu',
  'showInFilters',
  'showOnCards',
  'featured',
  'showAsRail',
  'linkTo',
  'status',
  'visibility',
  'seo',
]

const pick = (body) => coerce(terms, body, { allow: WRITABLE })

async function findTerm(id) {
  if (!isUuid(String(id))) return null
  const [row] = await db
    .select()
    .from(terms)
    .where(eq(terms.id, String(id)))
  return row || null
}

/** Every write here changes what the public site renders. */
const touched = async (res, payload) => {
  await invalidateEverywhere('siteConfig')
  return res.json(payload)
}

router.get(
  '/taxonomies',
  asyncHandler(async (_req, res) => {
    const counts = await db
      .select({ taxonomy: terms.taxonomy, count: count() })
      .from(terms)
      .groupBy(terms.taxonomy)
    const byName = Object.fromEntries(counts.map((c) => [c.taxonomy, c.count]))
    res.json({
      items: TAXONOMIES.map((name) => ({
        name,
        ...TAXONOMY_META[name],
        termCount: byName[name] || 0,
      })),
    })
  }),
)

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const clauses = []
    if (req.query.taxonomy) {
      if (!TAXONOMIES.includes(req.query.taxonomy)) throw new HttpError(400, 'Unknown taxonomy')
      clauses.push(eq(terms.taxonomy, req.query.taxonomy))
    }
    if (req.query.status) clauses.push(eq(terms.status, String(req.query.status)))
    const q = req.query.q?.trim()
    if (q) clauses.push(ilike(terms.name, `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`))

    const rows = await db
      .select()
      .from(terms)
      .where(clauses.length ? and(...clauses) : undefined)
      .orderBy(asc(terms.taxonomy), asc(terms.order), asc(terms.name))
    const items = withMongoId(rows)
    res.json({ items, total: items.length, usage: await usageMap(items) })
  }),
)

router.get(
  '/:id/usage',
  asyncHandler(async (req, res) => {
    const term = await findTerm(req.params.id)
    if (!term) throw new HttpError(404, 'Term not found')
    res.json(await countTermUsage(term))
  }),
)

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { taxonomy } = req.body
    if (!TAXONOMIES.includes(taxonomy)) throw new HttpError(400, 'Unknown taxonomy')
    const body = pick(req.body)
    if (!body.name?.trim()) throw new HttpError(400, 'Name is required')

    await assertValidParent(null, body.parent)

    const slug = await uniqueSlug(taxonomy, req.body.slug || body.name)
    const [created] = await db
      .insert(terms)
      .values({ ...body, name: body.name.trim(), taxonomy, slug })
      .returning()
    await invalidateEverywhere('siteConfig')
    res.status(201).json(withMongoId(created))
  }),
)

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const term = await findTerm(req.params.id)
    if (!term) throw new HttpError(404, 'Term not found')

    const body = pick(req.body)
    if ('name' in req.body && !String(req.body.name ?? '').trim()) {
      throw new HttpError(400, 'Name is required')
    }
    if ('parent' in body) await assertValidParent(term.id, body.parent)

    const previousName = term.name

    /*
     * Renaming has to repoint every document that references the old name,
     * otherwise the term list and the content drift apart and the catalogue
     * starts filtering on a name nothing carries any more.
     */
    let moved = 0
    if (body.name && body.name.trim() !== previousName) {
      moved = await reassignReferences(term.taxonomy, previousName, body.name.trim())
    }

    // The slug only changes when asked for explicitly, and the old one is kept
    // so inbound links and shared URLs keep resolving.
    const patch = { ...body }
    if (req.body.slug && req.body.slug !== term.slug) {
      patch.slug = await uniqueSlug(term.taxonomy, req.body.slug, term.id)
      patch.formerSlugs = [...new Set([...(term.formerSlugs || []), term.slug])]
    }
    if (body.name) patch.name = body.name.trim()

    const [updated] = Object.keys(patch).length
      ? await db.update(terms).set(patch).where(eq(terms.id, term.id)).returning()
      : [term]

    return touched(res, { term: withMongoId(updated), reassigned: moved })
  }),
)

router.post(
  '/reorder',
  asyncHandler(async (req, res) => {
    const items = Array.isArray(req.body?.items) ? req.body.items : []
    if (!items.length) throw new HttpError(400, 'Nothing to reorder')
    await db.transaction(async (tx) => {
      for (const { id, order } of items) {
        if (!isUuid(String(id))) continue
        await tx
          .update(terms)
          .set({ order: Number(order) || 0 })
          .where(eq(terms.id, String(id)))
      }
    })
    return touched(res, { ok: true, count: items.length })
  }),
)

router.post(
  '/merge',
  asyncHandler(async (req, res) => {
    const { sourceId, targetId } = req.body || {}
    if (!sourceId || !targetId) throw new HttpError(400, 'Pick a term to merge and a term to keep')
    const { moved, target } = await mergeTerms(sourceId, targetId)
    return touched(res, { ok: true, moved, target })
  }),
)

/**
 * Delete refuses while the term is still in use, unless the caller says what to
 * do with the orphans: `replaceWith` repoints them, `force=true` strips the
 * reference. Silently deleting a term in use would leave content filtered by a
 * name no longer in the registry.
 */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const term = await findTerm(req.params.id)
    if (!term) throw new HttpError(404, 'Term not found')

    const usage = await countTermUsage(term)
    if (usage.total > 0) {
      const { replaceWith, force } = req.query
      if (replaceWith) {
        const target = await findTerm(replaceWith)
        if (!target || target.taxonomy !== term.taxonomy) {
          throw new HttpError(400, 'Replacement term not found in this taxonomy')
        }
        await reassignReferences(term.taxonomy, term.name, target.name)
      } else if (force === 'true') {
        await reassignReferences(term.taxonomy, term.name, null)
      } else {
        throw new HttpError(
          409,
          `“${term.name}” is used by ${usage.total} item${usage.total === 1 ? '' : 's'}. Choose a replacement term, or confirm removing it from them.`,
        )
      }
    }

    await db.transaction(async (tx) => {
      await tx
        .update(terms)
        .set({ parent: term.parent || null })
        .where(eq(terms.parent, term.id))
      await tx.delete(terms).where(eq(terms.id, term.id))
    })
    return touched(res, { ok: true, reassigned: usage.total })
  }),
)

export default router
