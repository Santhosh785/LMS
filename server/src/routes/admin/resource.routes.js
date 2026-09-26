import { Router } from 'express'
import { asyncHandler, HttpError } from '../../middleware/error.js'
import { ClaudeSkill, Playbook } from '../../models/index.js'
import { crudRouter } from '../../utils/crudRouter.js'
import { slugify } from '../../services/taxonomy.js'

const router = Router()

/**
 * Admin CRUD for the Resources section.
 *
 * Both collections are ordinary content, so the generic crudRouter carries
 * list/create/read/update/delete. The one addition is reordering: the public
 * index pages sort by `order`, and dragging a card up the list is the whole
 * reason an operator opens this screen.
 */

/** Slugs are derived on write so two playbooks cannot collide silently. */
const normaliseSlug = (Model) =>
  asyncHandler(async (req, _res, next) => {
    if (req.body?.slug) req.body.slug = slugify(req.body.slug)
    else if (req.body?.title && req.method === 'POST') req.body.slug = slugify(req.body.title)

    if (req.body?.slug) {
      const clash = await Model.findOne({ slug: req.body.slug, _id: { $ne: req.params.id } })
        .select('_id')
        .lean()
      if (clash) throw new HttpError(400, 'Another entry already uses that slug')
    }
    next()
  })

/** `PUT /reorder` with an array of ids, in the order they should appear. */
const reorder = (Model) =>
  asyncHandler(async (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : []
    if (!ids.length) throw new HttpError(400, 'Send the ids in their new order')
    await Model.bulkWrite(
      ids.map((id, order) => ({ updateOne: { filter: { _id: id }, update: { $set: { order } } } })),
    )
    res.json({ ok: true })
  })

router.put('/playbooks/reorder', reorder(Playbook))
router.use('/playbooks', normaliseSlug(Playbook))
router.use(
  '/playbooks',
  crudRouter(Playbook, {
    searchFields: ['title', 'slug', 'tag', 'authorName'],
    sort: { order: 1, title: 1 },
  }),
)

router.put('/skills/reorder', reorder(ClaudeSkill))
router.use('/skills', normaliseSlug(ClaudeSkill))
router.use(
  '/skills',
  crudRouter(ClaudeSkill, {
    searchFields: ['title', 'slug', 'category', 'badge'],
    sort: { order: 1, title: 1 },
  }),
)

export default router
