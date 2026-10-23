import { Router } from 'express'
import { and, arrayContains, count, desc, eq, ilike, isNotNull, or } from 'drizzle-orm'
import { asyncHandler, HttpError } from '../middleware/error.js'
import { db, withMongoId } from '../db/index.js'
import { blogComments, blogPosts } from '../db/schema/index.js'
import {
  findPublicPostBySlug,
  findPublicPostPage,
  listColumns,
  publicPostWhere,
} from '../db/repos/blog.js'
import { blogCommentLimiter } from '../middleware/rateLimit.js'

const router = Router()

const escapeLike = (q) => q.replace(/[\\%_]/g, (c) => `\\${c}`)

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const clauses = [publicPostWhere()]
    // "latest" is the catch-all tab in the original category rail
    if (req.query.category && req.query.category !== 'latest') {
      clauses.push(eq(blogPosts.category, req.query.category))
    }
    if (req.query.tag) clauses.push(arrayContains(blogPosts.tags, [String(req.query.tag)]))
    if (req.query.q?.trim()) {
      const pattern = `%${escapeLike(req.query.q.trim())}%`
      clauses.push(or(ilike(blogPosts.title, pattern), ilike(blogPosts.excerpt, pattern)))
    }
    const where = and(...clauses)
    const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 100)
    const page = Math.max(Number(req.query.page) || 1, 1)
    const list = listColumns()
    const [items, [{ total }], featured, categories] = await Promise.all([
      db
        .select(list)
        .from(blogPosts)
        .where(where)
        .orderBy(desc(blogPosts.publishedAt))
        .offset((page - 1) * limit)
        .limit(limit),
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
    res.json({
      items: withMongoId(items),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      featured: withMongoId(featured),
      categories: categories.map((c) => c.category).filter(Boolean),
    })
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
