import { Router } from 'express'
import { asyncHandler } from '../middleware/error.js'
import { and, arrayContains, asc, desc, eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { courses as coursesTable, programs as programsTable, terms } from '../db/schema/index.js'
import { pickColumns } from '../db/repos/content.js'

const router = Router()

/**
 * The homepage's "New and popular" rails.
 *
 * A rail is a tag: any term flagged `showAsRail` becomes a column headed by the
 * term's name and filled with whatever carries that tag. The three columns used
 * to be hardcoded lists of course slugs in Home.jsx, so curating the homepage
 * meant a deploy; now it is applying a tag to a course.
 *
 * Courses and programs are both eligible, which is how the flagship program
 * sits in a rail beside courses. Everything is returned in one request so the
 * homepage does not fan out one call per rail.
 */

/** Only what a rail card renders — never the curriculum or the video ids. */
const COURSE_FIELDS =
  'title slug thumbClass mediaLabel image imageAlt hours amount rating durationLabel kind'
const PROGRAM_FIELDS = 'title slug eyebrow weeks heroImage'

const MAX_PER_RAIL = 6

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const rails = await db
      .select(pickColumns(terms, 'name slug linkTo description'))
      .from(terms)
      .where(
        and(
          eq(terms.status, 'Published'),
          eq(terms.visibility, 'Public'),
          eq(terms.showAsRail, true),
        ),
      )
      .orderBy(asc(terms.order), asc(terms.name))

    const items = await Promise.all(
      rails.map(async (rail) => {
        const [courses, programs] = await Promise.all([
          db
            .select(pickColumns(coursesTable, COURSE_FIELDS))
            .from(coursesTable)
            .where(
              and(
                arrayContains(coursesTable.tags, [rail.name]),
                eq(coursesTable.status, 'Published'),
                eq(coursesTable.visibility, 'Public'),
              ),
            )
            .orderBy(desc(coursesTable.popularity))
            .limit(MAX_PER_RAIL),
          db
            .select(pickColumns(programsTable, PROGRAM_FIELDS))
            .from(programsTable)
            .where(arrayContains(programsTable.tags, [rail.name]))
            .limit(MAX_PER_RAIL),
        ])

        return {
          name: rail.name,
          slug: rail.slug,
          description: rail.description || '',
          // Falls back to the tag's own catalogue view, so a rail heading is
          // never a dead link even when nobody set one.
          linkTo: rail.linkTo || `/courses?tag=${encodeURIComponent(rail.name)}`,
          // Programs lead: a rail carrying one is showcasing it.
          items: [
            ...programs.map((p) => ({
              kind: 'program',
              title: p.title,
              slug: p.slug,
              to: `/programs/${p.slug}`,
              eyebrow: p.eyebrow || '',
              image: p.heroImage || '',
              sub: p.weeks ? `${p.weeks}-Week Program` : '',
            })),
            ...courses.map((c) => ({
              kind: 'course',
              title: c.title,
              slug: c.slug,
              to: `/courses/${c.slug}`,
              thumbClass: c.thumbClass,
              image: c.image || '',
              imageAlt: c.imageAlt || '',
              sub: c.durationLabel || (c.hours ? `${c.hours} Hrs` : ''),
              amount: c.amount,
              rating: c.rating,
            })),
          ].slice(0, MAX_PER_RAIL),
        }
      }),
    )

    // A rail with nothing tagged into it would render as a bare heading.
    res.json({ rails: items.filter((r) => r.items.length > 0) })
  }),
)

export default router
