import { Router } from 'express'
import { asyncHandler, HttpError } from '../middleware/error.js'

/**
 * Standard list/create/read/update/delete router for the admin tables.
 * Every admin resource behaves the same way, so the shape lives in one place
 * and each resource only declares what makes it different.
 *
 * @param {import('mongoose').Model} Model
 * @param {object} [opts]
 * @param {string[]} [opts.searchFields]  fields the table's search box matches
 * @param {object}   [opts.sort]          default sort
 * @param {string}   [opts.populate]
 * @param {(req) => object} [opts.baseFilter]  extra filter, e.g. scoped by parent id
 */
export function crudRouter(Model, opts = {}) {
  const { searchFields = [], sort = { createdAt: -1 }, populate, baseFilter, projection } = opts

  const router = Router({ mergeParams: true })

  const buildFilter = (req) => {
    const filter = { ...(baseFilter ? baseFilter(req) : {}) }
    const q = req.query.q?.trim()
    if (q && searchFields.length) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      filter.$or = searchFields.map((f) => ({ [f]: rx }))
    }
    if (req.query.status) filter.status = req.query.status
    if (req.query.from || req.query.to) {
      const dateField = opts.dateField || 'createdAt'
      filter[dateField] = {}
      if (req.query.from) filter[dateField].$gte = new Date(req.query.from)
      if (req.query.to) filter[dateField].$lte = new Date(`${req.query.to}T23:59:59.999Z`)
    }
    return filter
  }

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const filter = buildFilter(req)
      const limit = Math.min(Number(req.query.limit) || 50, 200)
      const skip = Number(req.query.skip) || 0
      const sortSpec = req.query.sort
        ? { [req.query.sort.replace(/^-/, '')]: req.query.sort.startsWith('-') ? -1 : 1 }
        : sort

      let query = Model.find(filter).select(projection).sort(sortSpec).skip(skip).limit(limit)
      if (populate) query = query.populate(populate)

      const [items, total] = await Promise.all([query.lean(), Model.countDocuments(filter)])
      res.json({ items, total })
    }),
  )

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const payload = { ...req.body, ...(baseFilter ? baseFilter(req) : {}) }
      res.status(201).json(await Model.create(payload))
    }),
  )

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      let query = Model.findOne({ _id: req.params.id, ...(baseFilter ? baseFilter(req) : {}) })
      if (populate) query = query.populate(populate)
      const doc = await query.lean()
      if (!doc) throw new HttpError(404, `${Model.modelName} not found`)
      res.json(doc)
    }),
  )

  router.put(
    '/:id',
    asyncHandler(async (req, res) => {
      const doc = await Model.findOneAndUpdate(
        { _id: req.params.id, ...(baseFilter ? baseFilter(req) : {}) },
        req.body,
        { new: true, runValidators: true },
      )
      if (!doc) throw new HttpError(404, `${Model.modelName} not found`)
      res.json(doc)
    }),
  )

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const doc = await Model.findOneAndDelete({
        _id: req.params.id,
        ...(baseFilter ? baseFilter(req) : {}),
      })
      if (!doc) throw new HttpError(404, `${Model.modelName} not found`)
      res.json({ ok: true })
    }),
  )

  return router
}
