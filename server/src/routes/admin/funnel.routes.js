import { Router } from 'express'
import { crudRouter } from '../../utils/crudRouter.js'
import { asyncHandler, HttpError } from '../../middleware/error.js'
import { sendCsv } from '../../utils/csv.js'
import { and, asc, count, desc, eq } from 'drizzle-orm'
import { db, withMongoId } from '../../db/index.js'
import { coerce, isUuid } from '../../db/coerce.js'
import { funnelLeads, funnels, funnelSteps } from '../../db/schema/index.js'

const router = Router()

const findFunnel = async (id) => {
  if (!isUuid(id)) return null
  const [row] = await db.select().from(funnels).where(eq(funnels.id, id))
  return row || null
}

const stepsOf = (funnelId) =>
  isUuid(funnelId)
    ? db
        .select()
        .from(funnelSteps)
        .where(eq(funnelSteps.funnelId, funnelId))
        .orderBy(asc(funnelSteps.order))
    : Promise.resolve([])

/* ------------------------- leads across all funnels ---------------------- */
router.get(
  '/leads',
  asyncHandler(async (req, res) => {
    const clauses = []
    if (req.query.status) clauses.push(eq(funnelLeads.status, req.query.status))
    if (req.query.funnelId) {
      if (!isUuid(req.query.funnelId)) return res.json({ items: [], total: 0 })
      clauses.push(eq(funnelLeads.funnelId, req.query.funnelId))
    }
    const rows = await db
      .select({ lead: funnelLeads, funnel: { id: funnels.id, name: funnels.name } })
      .from(funnelLeads)
      .leftJoin(funnels, eq(funnels.id, funnelLeads.funnelId))
      .where(clauses.length ? and(...clauses) : undefined)
      .orderBy(desc(funnelLeads.date))
    // `funnelId` populated with the funnel's name, as the list was written for.
    const items = rows.map(({ lead, funnel }) =>
      withMongoId({ ...lead, funnelId: funnel?.id ? funnel : null }),
    )
    res.json({ items, total: items.length })
  }),
)

/* ------------------------------ per-funnel ------------------------------- */
router.get(
  '/:id/overview',
  asyncHandler(async (req, res) => {
    const funnel = await findFunnel(req.params.id)
    if (!funnel) throw new HttpError(404, 'Funnel not found')
    const byStatus = await db
      .select({ status: funnelLeads.status, n: count() })
      .from(funnelLeads)
      .where(eq(funnelLeads.funnelId, funnel.id))
      .groupBy(funnelLeads.status)
    const steps = await stepsOf(funnel.id)
    res.json({
      funnel: withMongoId(funnel),
      steps: withMongoId(steps),
      leadCount: byStatus.reduce((sum, s) => sum + s.n, 0),
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s.n])),
    })
  }),
)

router.get(
  '/:id/steps',
  asyncHandler(async (req, res) => {
    res.json({ items: withMongoId(await stepsOf(req.params.id)) })
  }),
)

router.put(
  '/:id/steps',
  asyncHandler(async (req, res) => {
    if (!(await findFunnel(req.params.id))) throw new HttpError(404, 'Funnel not found')
    const steps = Array.isArray(req.body.steps) ? req.body.steps : []
    // Replace-all in one transaction: a failed insert must not leave the funnel
    // with its old steps deleted and no new ones.
    const created = await db.transaction(async (tx) => {
      await tx.delete(funnelSteps).where(eq(funnelSteps.funnelId, req.params.id))
      if (!steps.length) return []
      return tx
        .insert(funnelSteps)
        .values(
          steps.map((s, i) => ({
            name: 'Step',
            ...coerce(funnelSteps, s),
            funnelId: req.params.id,
            order: i,
          })),
        )
        .returning()
    })
    res.json({ items: withMongoId(created) })
  }),
)

router.put(
  '/:id/automation',
  asyncHandler(async (req, res) => {
    const [funnel] = isUuid(req.params.id)
      ? await db
          .update(funnels)
          .set({ automationRules: req.body.automationRules || [] })
          .where(eq(funnels.id, req.params.id))
          .returning()
      : []
    if (!funnel) throw new HttpError(404, 'Funnel not found')
    res.json(withMongoId(funnel))
  }),
)

router.get(
  '/:id/leads/export',
  asyncHandler(async (req, res) => {
    const rows = isUuid(req.params.id)
      ? await db
          .select()
          .from(funnelLeads)
          .where(eq(funnelLeads.funnelId, req.params.id))
          .orderBy(desc(funnelLeads.date))
      : []
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
    if (!isUuid(req.params.id)) return res.json({ items: [], total: 0 })
    const items = await db
      .select()
      .from(funnelLeads)
      .where(
        and(
          eq(funnelLeads.funnelId, req.params.id),
          req.query.status ? eq(funnelLeads.status, req.query.status) : undefined,
        ),
      )
      .orderBy(desc(funnelLeads.date))
    res.json({ items: withMongoId(items), total: items.length })
  }),
)

router.use(
  '/',
  crudRouter(funnels, {
    name: 'Funnel',
    searchFields: ['name', 'template'],
    sort: { createdAt: -1 },
  }),
)

export default router
