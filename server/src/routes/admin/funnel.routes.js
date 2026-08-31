import { Router } from 'express'
import { crudRouter } from '../../utils/crudRouter.js'
import { asyncHandler, HttpError } from '../../middleware/error.js'
import { sendCsv } from '../../utils/csv.js'
import { Funnel, FunnelStep, FunnelLead } from '../../models/index.js'

const router = Router()

/* ------------------------- leads across all funnels ---------------------- */
router.get(
  '/leads',
  asyncHandler(async (req, res) => {
    const filter = {}
    if (req.query.status) filter.status = req.query.status
    if (req.query.funnelId) filter.funnelId = req.query.funnelId
    const items = await FunnelLead.find(filter)
      .populate('funnelId', 'name')
      .sort({ date: -1 })
      .lean()
    res.json({ items, total: items.length })
  }),
)

/* ------------------------------ per-funnel ------------------------------- */
router.get(
  '/:id/overview',
  asyncHandler(async (req, res) => {
    const funnel = await Funnel.findById(req.params.id).lean()
    if (!funnel) throw new HttpError(404, 'Funnel not found')
    const [steps, leadCount, byStatus] = await Promise.all([
      FunnelStep.find({ funnelId: funnel._id }).sort({ order: 1 }).lean(),
      FunnelLead.countDocuments({ funnelId: funnel._id }),
      FunnelLead.aggregate([
        { $match: { funnelId: funnel._id } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
    ])
    res.json({
      funnel,
      steps,
      leadCount,
      byStatus: Object.fromEntries(byStatus.map((s) => [s._id, s.count])),
    })
  }),
)

router.get(
  '/:id/steps',
  asyncHandler(async (req, res) => {
    const items = await FunnelStep.find({ funnelId: req.params.id }).sort({ order: 1 }).lean()
    res.json({ items })
  }),
)

router.put(
  '/:id/steps',
  asyncHandler(async (req, res) => {
    const steps = Array.isArray(req.body.steps) ? req.body.steps : []
    await FunnelStep.deleteMany({ funnelId: req.params.id })
    const created = await FunnelStep.insertMany(
      steps.map((s, i) => ({ ...s, _id: undefined, funnelId: req.params.id, order: i })),
    )
    res.json({ items: created })
  }),
)

router.put(
  '/:id/automation',
  asyncHandler(async (req, res) => {
    const funnel = await Funnel.findByIdAndUpdate(
      req.params.id,
      { automationRules: req.body.automationRules || [] },
      { new: true },
    )
    if (!funnel) throw new HttpError(404, 'Funnel not found')
    res.json(funnel)
  }),
)

router.get(
  '/:id/leads/export',
  asyncHandler(async (req, res) => {
    const rows = await FunnelLead.find({ funnelId: req.params.id }).sort({ date: -1 }).lean()
    sendCsv(res, 'funnel-leads.csv', rows, [
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'sourceStep', label: 'Source step' },
      { key: 'date', label: 'Date', get: (r) => r.date?.toISOString().slice(0, 10) },
      { key: 'status', label: 'Status' },
    ])
  }),
)

router.get(
  '/:id/leads',
  asyncHandler(async (req, res) => {
    const filter = { funnelId: req.params.id }
    if (req.query.status) filter.status = req.query.status
    const items = await FunnelLead.find(filter).sort({ date: -1 }).lean()
    res.json({ items, total: items.length })
  }),
)

router.use('/', crudRouter(Funnel, { searchFields: ['name', 'template'], sort: { createdAt: -1 } }))

export default router
