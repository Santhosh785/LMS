import { and, asc, eq, inArray, lte } from 'drizzle-orm'
import { db } from '../index.js'
import { blogPosts } from '../schema/index.js'
import { omitColumns } from './content.js'

/**
 * Archive and card lists never need the block body or the revision history,
 * which are by far the largest columns a post has.
 */
export const withoutColumns = (excluded) => omitColumns(blogPosts, excluded)

export const listColumns = () => withoutColumns(['body', 'revisions'])

/**
 * What "public" means for a blog post — the one definition, shared by the
 * public blog API, the sitemap and the SEO resolver. A function, not a
 * constant, because "due" is evaluated against the clock at query time.
 */
// Only published (or scheduled-and-due) posts are public. Rows migrated from
// seeded documents that predate the publishing workflow are given 'Published'
// by the ETL, so there is no "status missing" case left to allow for.
export const publicPostWhere = () =>
  and(
    inArray(blogPosts.status, ['Published', 'Scheduled']),
    // Private and password-protected posts are editorial states, not public
    // ones — they stay out of the archive and out of a direct slug hit alike.
    eq(blogPosts.visibility, 'Public'),
    lte(blogPosts.publishedAt, new Date()),
  )

/**
 * A public post by slug, or null. `columns` narrows the select; the default is
 * the article page's: everything but the revision history.
 */
export async function findPublicPostBySlug(slug, columns = withoutColumns(['revisions'])) {
  const [row] = await db
    .select(columns)
    .from(blogPosts)
    .where(and(eq(blogPosts.slug, String(slug).toLowerCase()), publicPostWhere()))
  return row || null
}

/** `{ slug, updatedAt }` for every public post — the sitemap's input. */
export function listPublicPostSlugs() {
  return db
    .select({ slug: blogPosts.slug, updatedAt: blogPosts.updatedAt })
    .from(blogPosts)
    .where(publicPostWhere())
    .orderBy(asc(blogPosts.slug))
}
