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
  lte,
  or,
} from 'drizzle-orm'
import { db, withMongoId } from '../index.js'
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
