import { Router } from 'express'
import { and, desc, eq } from 'drizzle-orm'
import { asyncHandler, HttpError } from '../middleware/error.js'
import { db, withMongoId } from '../db/index.js'
import { blogComments, blogPosts } from '../db/schema/index.js'
import {
  findPublicPostBySlug,
  findPublicPostPage,
  listPublicPosts,
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

router.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const page = await findPublicPostPage(req.params.slug)
    if (!page) throw new HttpError(404, 'Article not found')
    res.json(page)
  }),
)

export default router
