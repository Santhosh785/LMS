import { Router } from 'express'
import { crudRouter } from '../../utils/crudRouter.js'
import { asyncHandler } from '../../middleware/error.js'
import { Badge, PointRule, LeaderboardEntry, Setting } from '../../models/index.js'

const router = Router()

/* --------------------------------- points -------------------------------- */
router.get(
  '/points',
  asyncHandler(async (_req, res) => {
    const [rules, setting] = await Promise.all([
      PointRule.find().sort({ order: 1 }).lean(),
      Setting.getSingleton(),
    ])
    res.json({ rules, gamification: setting.gamification })
  }),
)

router.put(
  '/points',
  asyncHandler(async (req, res) => {
    if (Array.isArray(req.body.rules)) {
      await Promise.all(
        req.body.rules.map((rule) =>
          PointRule.findByIdAndUpdate(rule._id, { points: rule.points, enabled: rule.enabled }),
        ),
      )
    }
    const setting = await Setting.getSingleton()
    if (req.body.gamification) {
      setting.gamification = { ...setting.gamification.toObject(), ...req.body.gamification }
      await setting.save()
    }
    const rules = await PointRule.find().sort({ order: 1 }).lean()
    res.json({ rules, gamification: setting.gamification })
  }),
)

/* ------------------------------ leaderboard ------------------------------ */
router.get(
  '/leaderboard',
  asyncHandler(async (req, res) => {
    const period = ['week', 'month', 'all'].includes(req.query.period) ? req.query.period : 'week'
    const items = await LeaderboardEntry.find({ period }).sort({ board: 1, rank: 1 }).lean()
    const boards = [...new Set(items.map((i) => i.board))].map((board) => ({
      board,
      entries: items.filter((i) => i.board === board),
    }))
    res.json({ period, items, boards })
  }),
)

/* -------------------------------- settings ------------------------------- */
router.get(
  '/settings',
  asyncHandler(async (_req, res) => {
    const setting = await Setting.getSingleton()
    res.json(setting.gamification)
  }),
)

router.put(
  '/settings',
  asyncHandler(async (req, res) => {
    const setting = await Setting.getSingleton()
    setting.gamification = { ...setting.gamification.toObject(), ...req.body }
    await setting.save()
    res.json(setting.gamification)
  }),
)

/* --------------------------------- badges -------------------------------- */
router.use('/badges', crudRouter(Badge, { searchFields: ['name'], sort: { createdAt: 1 } }))

export default router
