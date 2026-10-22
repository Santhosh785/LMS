import { Router } from 'express'
import { asc, eq } from 'drizzle-orm'
import { asyncHandler, HttpError } from '../middleware/error.js'
import { db, withMongoId } from '../db/index.js'
import { programs } from '../db/schema/index.js'

const router = Router()

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const rows = await db.select().from(programs).orderBy(asc(programs.createdAt))
    res.json({ items: withMongoId(rows) })
  }),
)

router.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const [program] = await db
      .select()
      .from(programs)
      .where(eq(programs.slug, String(req.params.slug).toLowerCase()))
    if (!program) throw new HttpError(404, 'Program not found')
    res.json(withMongoId(program))
  }),
)

export default router
