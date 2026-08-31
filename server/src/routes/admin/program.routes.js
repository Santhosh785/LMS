import { Router } from 'express'
import { asyncHandler, HttpError } from '../../middleware/error.js'
import { Program } from '../../models/index.js'
import { crudRouter } from '../../utils/crudRouter.js'
import { slugify } from '../../services/taxonomy.js'

const router = Router()

/**
 * Programs, which had no admin surface at all — the flagship's price, copy and
 * curriculum could only be changed by editing seed/data/program.js and
 * re-running the seeder.
 *
 * Saves are per-tab, like courses, so one screen cannot clobber another's
 * slice of the document.
 */
const TAB_FIELDS = {
  information: [
    'title',
    'slug',
    'eyebrow',
    'description',
    'weeks',
    'meta',
    'heroImage',
    'categories',
    'tags',
  ],
  // The page furniture that used to be hardcoded in ProgramDetail.jsx.
  copy: ['sectionCopy', 'ctas', 'phaseLabels'],
  content: ['outcomes', 'stats', 'comparison', 'audience', 'admission', 'mentors', 'testimonials'],
  curriculum: ['curriculum'],
  pricing: ['pricing'],
  faqs: ['faqs'],
}

for (const [tab, fields] of Object.entries(TAB_FIELDS)) {
  router.put(
    `/:id/${tab}`,
    asyncHandler(async (req, res) => {
      const patch = Object.fromEntries(Object.entries(req.body).filter(([k]) => fields.includes(k)))
      if (patch.slug) patch.slug = slugify(patch.slug)
      const program = await Program.findByIdAndUpdate(req.params.id, patch, {
        new: true,
        runValidators: true,
      })
      if (!program) throw new HttpError(404, 'Program not found')
      res.json(program)
    }),
  )
}

router.use('/', crudRouter(Program, { searchFields: ['title', 'slug'], sort: { createdAt: -1 } }))

export default router
