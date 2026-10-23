import { asc, eq } from 'drizzle-orm'
import { db } from '../index.js'
import { programs } from '../schema/index.js'

/**
 * Programs have no status or visibility column: every row is public, so there
 * is no public-only predicate to share here.
 */

/** A program by slug, as stored (no `_id`), or undefined. */
export async function findProgramBySlug(slug) {
  const [program] = await db
    .select()
    .from(programs)
    .where(eq(programs.slug, String(slug).toLowerCase()))
  return program
}

/** `{ slug, updatedAt }` for every program — the sitemap's input. */
export function listProgramSlugs() {
  return db
    .select({ slug: programs.slug, updatedAt: programs.updatedAt })
    .from(programs)
    .orderBy(asc(programs.slug))
}
