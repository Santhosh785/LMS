import {
  and,
  arrayContains,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lte,
  ne,
  or,
} from 'drizzle-orm'
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

const escapeLike = (q) => q.replace(/[\\%_]/g, (c) => `\\${c}`)

/**
 * One page of the public blog archive — GET /api/blog and the server-rendered
 * /blog page read the same rows. Public posts only (publicPostWhere), newest
 * first, card columns only. `category` 'latest' (or none) is the catch-all tab
 * of the category rail; `q` matches title or excerpt. `page` and `limit` are
 * coerced as the API always has (limit 1–100, default 12; page ≥ 1) — a page
 * past the end comes back empty, with `pages` saying how many there are.
 *
 * Returns `{ items, total, page, pages, featured, categories }`, document-shaped.
 */
export async function listPublicPosts({ category, tag, q, page, limit } = {}) {
  const clauses = [publicPostWhere()]
  if (category && category !== 'latest') clauses.push(eq(blogPosts.category, String(category)))
  if (tag) clauses.push(arrayContains(blogPosts.tags, [String(tag)]))
  const term = typeof q === 'string' ? q.trim() : ''
  if (term) {
    const pattern = `%${escapeLike(term)}%`
    clauses.push(or(ilike(blogPosts.title, pattern), ilike(blogPosts.excerpt, pattern)))
  }
  const where = and(...clauses)
  const size = Math.min(Math.max(Number(limit) || 12, 1), 100)
  const current = Math.max(Math.floor(Number(page)) || 1, 1)
  const list = listColumns()
  const [items, [{ total }], featured, categories] = await Promise.all([
    db
      .select(list)
      .from(blogPosts)
      .where(where)
      .orderBy(desc(blogPosts.publishedAt))
      .offset((current - 1) * size)
      .limit(size),
    db.select({ total: count() }).from(blogPosts).where(where),
    db
      .select(list)
      .from(blogPosts)
      .where(and(publicPostWhere(), eq(blogPosts.featured, true)))
      .orderBy(desc(blogPosts.publishedAt)),
    db
      .selectDistinct({ category: blogPosts.category })
      .from(blogPosts)
      .where(and(publicPostWhere(), isNotNull(blogPosts.category))),
  ])
  return {
    items: withMongoId(items),
    total,
    page: current,
    pages: Math.max(1, Math.ceil(total / size)),
    featured: withMongoId(featured),
    categories: categories.map((c) => c.category).filter(Boolean),
  }
}
