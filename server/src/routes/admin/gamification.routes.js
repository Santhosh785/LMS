import { Router } from 'express'
import { crudRouter } from '../../utils/crudRouter.js'
import { asyncHandler } from '../../middleware/error.js'
import { asc, eq } from 'drizzle-orm'
import { db, withMongoId } from '../../db/index.js'
import { isUuid } from '../../db/coerce.js'
import { badges, leaderboardEntries, pointRules } from '../../db/schema/index.js'
import { getSettings, updateSettings } from '../../db/repos/settings.js'
import { pickKeys } from './settings.routes.js'

const router = Router()

const GAMIFICATION_KEYS = ['pointsName', 'pointsIcon', 'leaderboardEnabled', 'showOnProfile']

const listRules = async () =>
  withMongoId(await db.select().from(pointRules).orderBy(asc(pointRules.order)))

/* --------------------------------- points -------------------------------- */
router.get(
  '/points',
  asyncHandler(async (_req, res) => {
    const [rules, setting] = await Promise.all([listRules(), getSettings()])
    res.json({ rules, gamification: setting.gamification })
  }),
)

router.put(
  '/points',
  asyncHandler(async (req, res) => {
    if (Array.isArray(req.body.rules)) {
      await db.transaction(async (tx) => {
        for (const rule of req.body.rules) {
          const id = rule._id || rule.id
          if (!isUuid(id)) continue
          const values = {}
          if (rule.points !== undefined) values.points = Number(rule.points) || 0
          if (rule.enabled !== undefined) values.enabled = Boolean(rule.enabled)
          if (Object.keys(values).length) {
            await tx.update(pointRules).set(values).where(eq(pointRules.id, id))
          }
        }
      })
    }
    const setting = req.body.gamification
      ? await updateSettings({ gamification: pickKeys(req.body.gamification, GAMIFICATION_KEYS) })
      : await getSettings()
    res.json({ rules: await listRules(), gamification: setting.gamification })
  }),
)

/* ------------------------------ leaderboard ------------------------------ */
router.get(
  '/leaderboard',
  asyncHandler(async (req, res) => {
    const period = ['week', 'month', 'all'].includes(req.query.period) ? req.query.period : 'week'
    const items = withMongoId(
      await db
        .select()
        .from(leaderboardEntries)
        .where(eq(leaderboardEntries.period, period))
        .orderBy(asc(leaderboardEntries.board), asc(leaderboardEntries.rank)),
    )
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
    res.json((await getSettings()).gamification)
  }),
)

router.put(
  '/settings',
  asyncHandler(async (req, res) => {
    const setting = await updateSettings({
      gamification: pickKeys(req.body, GAMIFICATION_KEYS),
    })
    res.json(setting.gamification)
  }),
)

/* --------------------------------- badges -------------------------------- */
router.use(
  '/badges',
  crudRouter(badges, { name: 'Badge', searchFields: ['name'], sort: { createdAt: 1 } }),
)

export default router
