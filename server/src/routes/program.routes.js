import { Router } from 'express'
import { asyncHandler, HttpError } from '../middleware/error.js'
import Program from '../models/Program.js'

const router = Router()

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json({ items: await Program.find().lean() })
  }),
)

router.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const program = await Program.findOne({ slug: req.params.slug }).lean()
    if (!program) throw new HttpError(404, 'Program not found')
    res.json(program)
  }),
)

export default router
