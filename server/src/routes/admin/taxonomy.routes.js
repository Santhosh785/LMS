import { Router } from 'express'
import { asyncHandler, HttpError } from '../../middleware/error.js'
import Term, { TAXONOMIES } from '../../models/Term.js'
import {
  assertValidParent,
  countTermUsage,
  mergeTerms,
  reassignReferences,
  uniqueSlug,
  usageMap,
} from '../../services/taxonomy.js'
import { invalidateSiteConfig } from '../../services/siteConfig.js'

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

const pick = (body) =>
  Object.fromEntries(Object.entries(body || {}).filter(([k]) => WRITABLE.includes(k)))

/** Every write here changes what the public site renders. */
const touched = (res, payload) => {
  invalidateSiteConfig()
  return res.json(payload)
}

router.get(
  '/taxonomies',
  asyncHandler(async (_req, res) => {
    const counts = await Term.aggregate([{ $group: { _id: '$taxonomy', count: { $sum: 1 } } }])
    const byName = Object.fromEntries(counts.map((c) => [c._id, c.count]))
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
    const filter = {}
    if (req.query.taxonomy) {
      if (!TAXONOMIES.includes(req.query.taxonomy)) throw new HttpError(400, 'Unknown taxonomy')
      filter.taxonomy = req.query.taxonomy
    }
    if (req.query.status) filter.status = req.query.status
    const q = req.query.q?.trim()
    if (q) filter.name = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')

    const items = await Term.find(filter).sort({ taxonomy: 1, order: 1, name: 1 }).lean()
    res.json({ items, total: items.length, usage: await usageMap(items) })
  }),
)

router.get(
  '/:id/usage',
  asyncHandler(async (req, res) => {
    const term = await Term.findById(req.params.id).lean()
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
    const created = await Term.create({ ...body, taxonomy, slug })
    invalidateSiteConfig()
    res.status(201).json(created)
  }),
)

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const term = await Term.findById(req.params.id)
    if (!term) throw new HttpError(404, 'Term not found')

    const body = pick(req.body)
    if ('name' in body && !body.name?.trim()) throw new HttpError(400, 'Name is required')
    if ('parent' in body) await assertValidParent(term._id, body.parent)

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
    if (req.body.slug && req.body.slug !== term.slug) {
      const next = await uniqueSlug(term.taxonomy, req.body.slug, term._id)
      term.formerSlugs = [...new Set([...(term.formerSlugs || []), term.slug])]
      term.slug = next
    }

    Object.assign(term, body)
    if (body.name) term.name = body.name.trim()
    await term.save()

    return touched(res, { term, reassigned: moved })
  }),
)

router.post(
  '/reorder',
  asyncHandler(async (req, res) => {
    const items = Array.isArray(req.body?.items) ? req.body.items : []
    if (!items.length) throw new HttpError(400, 'Nothing to reorder')
    await Term.bulkWrite(
      items.map(({ id, order }) => ({
        updateOne: { filter: { _id: id }, update: { $set: { order: Number(order) || 0 } } },
      })),
    )
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
    const term = await Term.findById(req.params.id)
    if (!term) throw new HttpError(404, 'Term not found')

    const usage = await countTermUsage(term)
    if (usage.total > 0) {
      const { replaceWith, force } = req.query
      if (replaceWith) {
        const target = await Term.findById(replaceWith).lean()
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

    await Term.updateMany({ parent: term._id }, { $set: { parent: term.parent || null } })
    await term.deleteOne()
    return touched(res, { ok: true, reassigned: usage.total })
  }),
)

export default router
