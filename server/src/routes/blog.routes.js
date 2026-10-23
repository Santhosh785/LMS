import { Router } from 'express'
import { and, desc, eq, inArray, isNull, ne } from 'drizzle-orm'
import { asyncHandler, HttpError } from '../middleware/error.js'
import { db, withMongoId } from '../db/index.js'
import { blogComments, blogPosts, media } from '../db/schema/index.js'
import {
  findPublicPostBySlug,
  listPublicPosts,
  publicPostWhere,
  withoutColumns,
} from '../db/repos/blog.js'
import { blogCommentLimiter } from '../middleware/rateLimit.js'

const router = Router()

router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(
      await listPublicPosts({
        category: req.query.category,
        tag: req.query.tag,
        q: req.query.q,
        page: req.query.page,
        limit: req.query.limit,
      }),
    )
  }),
)

router.get(
  '/:slug/comments',
  asyncHandler(async (req, res) => {
    const post = await findPublicPostBySlug(req.params.slug, {
      id: blogPosts.id,
      allowComments: blogPosts.allowComments,
    })
    if (!post) throw new HttpError(404, 'Article not found')
    if (!post.allowComments) return res.json({ items: [], commentsOpen: false })
    const items = await db
      .select({
        id: blogComments.id,
        name: blogComments.name,
        body: blogComments.body,
        createdAt: blogComments.createdAt,
      })
      .from(blogComments)
      .where(and(eq(blogComments.postId, post.id), eq(blogComments.status, 'Approved')))
      .orderBy(desc(blogComments.createdAt))
    res.json({ items: withMongoId(items), commentsOpen: true })
  }),
)

router.post(
  '/:slug/comments',
  blogCommentLimiter,
  asyncHandler(async (req, res) => {
    const post = await findPublicPostBySlug(req.params.slug, {
      id: blogPosts.id,
      allowComments: blogPosts.allowComments,
    })
    if (!post) throw new HttpError(404, 'Article not found')
    if (!post.allowComments) throw new HttpError(403, 'Comments are closed for this article')
    const name = String(req.body?.name || '').trim()
    const email = String(req.body?.email || '')
      .trim()
      .toLowerCase()
    const body = String(req.body?.body || '').trim()
    if (!name || !email || !body) throw new HttpError(400, 'Name, email and comment are required')
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, 'Enter a valid email address')
    // The length caps the Mongoose schema enforced, applied before the insert.
    await db.insert(blogComments).values({
      postId: post.id,
      name: name.slice(0, 100),
      email: email.slice(0, 254),
      body: body.slice(0, 4000),
    })
    res.status(201).json({ ok: true, message: 'Thanks — your comment is awaiting approval.' })
  }),
)

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

router.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const found = await findPublicPostBySlug(req.params.slug, withoutColumns(['revisions']))
    if (!found) throw new HttpError(404, 'Article not found')
    const post = await withImageSources(withMongoId(found))
    const related = await db
      .select(withoutColumns(['body', 'revisions']))
      .from(blogPosts)
      .where(
        and(
          ne(blogPosts.id, post.id),
          found.category ? eq(blogPosts.category, found.category) : isNull(blogPosts.category),
          publicPostWhere(),
        ),
      )
      .limit(3)
    res.json({ post, related: withMongoId(related) })
  }),
)

export default router
