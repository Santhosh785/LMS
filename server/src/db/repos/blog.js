import { and, asc, eq, inArray, isNull, lte, ne } from 'drizzle-orm'
import { db, withMongoId } from '../index.js'
import { blogPosts, media } from '../schema/index.js'
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

/**
 * Attaches a `srcset` to every image that came from the Media Library.
 *
 * The derivatives live on the Media row, not on the post, so that regenerating
 * them flows through to published articles instead of leaving them pointing at
 * URLs that no longer exist. That means one lookup here, at read time, rather
 * than a copy of today's URLs baked into every post body.
 */
async function withImageSources(post) {
  const ids = [post.imageMediaId, ...(post.body || []).map((block) => block.mediaId)]
    .filter(Boolean)
    .map(String)
    .filter((id) => /^[0-9a-f-]{36}$/i.test(id))
  if (!ids.length) return post

  const rows = await db
    .select({
      id: media.id,
      url: media.url,
      width: media.width,
      height: media.height,
      sizes: media.sizes,
    })
    .from(media)
    .where(inArray(media.id, ids))
  const byId = new Map(rows.map((row) => [String(row.id), row]))

  // Widest last: a browser picks the first candidate that satisfies `sizes`.
  const srcsetFor = (row) =>
    [...(row.sizes || []), { url: row.url, width: row.width }]
      .filter((variant) => variant.url && variant.width)
      .sort((a, b) => a.width - b.width)
      .map((variant) => `${variant.url} ${variant.width}w`)
      .join(', ') || ''

  const cover = post.imageMediaId && byId.get(String(post.imageMediaId))
  return {
    ...post,
    ...(cover
      ? { imageSrcset: srcsetFor(cover), imageWidth: cover.width, imageHeight: cover.height }
      : {}),
    body: (post.body || []).map((block) => {
      const row = block.mediaId && byId.get(String(block.mediaId))
      return row ? { ...block, srcset: srcsetFor(row) } : block
    }),
  }
}

/**
 * Everything the article page shows, for a public post: the post (no revision
 * history, Media Library srcsets attached) and up to three other public posts
 * from the same category. Null when the slug has no public post. The public
 * blog API (GET /api/blog/:slug) and the server-rendered page both read this,
 * so the two cannot disagree about what an article carries.
 */
export async function findPublicPostPage(slug) {
  const found = await findPublicPostBySlug(slug)
  if (!found) return null
  const [post, related] = await Promise.all([
    withImageSources(withMongoId(found)),
    db
      .select(listColumns())
      .from(blogPosts)
      .where(
        and(
          ne(blogPosts.id, found.id),
          found.category ? eq(blogPosts.category, found.category) : isNull(blogPosts.category),
          publicPostWhere(),
        ),
      )
      .limit(3),
  ])
  return { post, related: withMongoId(related) }
}

/** `{ slug, updatedAt }` for every public post — the sitemap's input. */
export function listPublicPostSlugs() {
  return db
    .select({ slug: blogPosts.slug, updatedAt: blogPosts.updatedAt })
    .from(blogPosts)
    .where(publicPostWhere())
    .orderBy(asc(blogPosts.slug))
}
