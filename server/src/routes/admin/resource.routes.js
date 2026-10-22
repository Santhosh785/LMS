import { Router } from 'express'
import { asyncHandler, HttpError } from '../../middleware/error.js'
import { and, eq, ne } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { isUuid } from '../../db/coerce.js'
import { claudeSkills, playbooks } from '../../db/schema/index.js'
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

/**
 * Slugs are derived on write so two playbooks cannot collide silently.
 *
 * Mounted with `router.use`, so `:id` is not parsed into req.params here; the
 * row being edited is read from the path instead, or saving an entry with its
 * own unchanged slug would count as a clash with itself.
 */
const normaliseSlug = (table) =>
  asyncHandler(async (req, _res, next) => {
    if (req.body?.slug) req.body.slug = slugify(req.body.slug)
    else if (req.body?.title && req.method === 'POST') req.body.slug = slugify(req.body.title)

    if (req.body?.slug && (req.method === 'POST' || req.method === 'PUT')) {
      const selfId = req.path.split('/').filter(Boolean)[0]
      const [clash] = await db
        .select({ id: table.id })
        .from(table)
        .where(
          and(eq(table.slug, req.body.slug), isUuid(selfId) ? ne(table.id, selfId) : undefined),
        )
      if (clash) throw new HttpError(400, 'Another entry already uses that slug')
    }
    next()
  })

/** `PUT /reorder` with an array of ids, in the order they should appear. */
const reorder = (table) =>
  asyncHandler(async (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : []
    if (!ids.length) throw new HttpError(400, 'Send the ids in their new order')
    // One transaction, so a half-applied reorder never shows two cards at once.
    await db.transaction(async (tx) => {
      for (const [order, id] of ids.entries()) {
        if (isUuid(String(id)))
          await tx
            .update(table)
            .set({ order })
            .where(eq(table.id, String(id)))
      }
    })
    res.json({ ok: true })
  })

router.put('/playbooks/reorder', reorder(playbooks))
router.use('/playbooks', normaliseSlug(playbooks))
router.use(
  '/playbooks',
  crudRouter(playbooks, {
    name: 'Playbook',
    searchFields: ['title', 'slug', 'tag', 'authorName'],
    sort: { order: 1, title: 1 },
  }),
)

router.put('/skills/reorder', reorder(claudeSkills))
router.use('/skills', normaliseSlug(claudeSkills))
router.use(
  '/skills',
  crudRouter(claudeSkills, {
    name: 'Skill',
    searchFields: ['title', 'slug', 'category', 'badge'],
    sort: { order: 1, title: 1 },
  }),
)

export default router
