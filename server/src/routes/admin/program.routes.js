import { Router } from 'express'
import { asyncHandler, HttpError } from '../../middleware/error.js'
import { eq } from 'drizzle-orm'
import { db, withMongoId } from '../../db/index.js'
import { coerce, isUuid } from '../../db/coerce.js'
import { programs } from '../../db/schema/index.js'
import { crudRouter } from '../../utils/crudRouter.js'
import { slugify } from '../../services/taxonomy.js'
import { safeContentChanged } from '../../services/contentEvents.js'

const router = Router()

/** Sitemap + edge purge for a program page, under its old slug too on a rename. */
const programChanged = (...slugs) =>
  safeContentChanged({ kind: 'program', slugs: [...new Set(slugs.filter(Boolean))] })

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
    // Hero scarcity line — changes every batch, so it sits with the other
    // information fields rather than the structural content below.
    'batchNote',
  ],
  // The page furniture that used to be hardcoded in ProgramDetail.jsx.
  copy: ['sectionCopy', 'ctas', 'phaseLabels'],
  content: [
    'outcomes',
    'stats',
    'comparison',
    'audience',
    'admission',
    'mentors',
    'testimonials',
    // 2026 redesign sections — see the programs table in db/schema/content.js.
    'trustBar',
    'why',
    'structure',
    'tracks',
    'toolGroups',
  ],
  curriculum: ['curriculum'],
  pricing: ['pricing'],
  faqs: ['faqs'],
}

for (const [tab, fields] of Object.entries(TAB_FIELDS)) {
  router.put(
    `/:id/${tab}`,
    asyncHandler(async (req, res) => {
      if (!isUuid(req.params.id)) throw new HttpError(404, 'Program not found')
      const patch = coerce(programs, req.body, { allow: fields })
      if (patch.slug) patch.slug = slugify(patch.slug)
      const [before] = patch.slug
        ? await db
            .select({ slug: programs.slug })
            .from(programs)
            .where(eq(programs.id, req.params.id))
        : []
      const [program] = Object.keys(patch).length
        ? await db.update(programs).set(patch).where(eq(programs.id, req.params.id)).returning()
        : await db.select().from(programs).where(eq(programs.id, req.params.id))
      if (!program) throw new HttpError(404, 'Program not found')
      // These tab saves bypass the CRUD router, so they announce themselves.
      if (Object.keys(patch).length) await programChanged(program.slug, before?.slug)
      res.json(withMongoId(program))
    }),
  )
}

router.use(
  '/',
  crudRouter(programs, {
    name: 'Program',
    searchFields: ['title', 'slug'],
    sort: { createdAt: -1 },
    onChange: (_kind, row, previous) => programChanged(row.slug, previous?.slug),
  }),
)

export default router
