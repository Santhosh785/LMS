import { Router } from 'express'
import { asyncHandler, HttpError } from '../middleware/error.js'
import BlogPost from '../models/BlogPost.js'
import BlogComment from '../models/BlogComment.js'
import Media from '../models/Media.js'
import { blogCommentLimiter } from '../middleware/rateLimit.js'

const router = Router()

// Seeded documents predate the publishing workflow and therefore have no
// status. Treat them as published; every post created from the new editor has
// an explicit status.
const publicFilter = () => ({
  $and: [
    { $or: [{ status: { $in: ['Published', 'Scheduled'] } }, { status: { $exists: false } }] },
    // Private and password-protected posts are editorial states, not public
    // ones — they stay out of the archive and out of a direct slug hit alike.
    { $or: [{ visibility: 'Public' }, { visibility: { $exists: false } }] },
    { publishedAt: { $lte: new Date() } },
  ],
})

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter = publicFilter()
    // "latest" is the catch-all tab in the original category rail
    if (req.query.category && req.query.category !== 'latest') {
      filter.$and.push({ category: req.query.category })
    }
    if (req.query.tag) filter.$and.push({ tags: req.query.tag })
    if (req.query.q?.trim()) {
      const q = req.query.q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      filter.$and.push({ $or: [{ title: new RegExp(q, 'i') }, { excerpt: new RegExp(q, 'i') }] })
    }
    const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 100)
    const page = Math.max(Number(req.query.page) || 1, 1)
    const [items, total, featured, categories] = await Promise.all([
      BlogPost.find(filter)
        .select('-body -revisions')
        .sort({ publishedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      BlogPost.countDocuments(filter),
      BlogPost.find({ ...publicFilter(), featured: true })
        .select('-body -revisions')
        .sort({ publishedAt: -1 })
        .lean(),
      BlogPost.distinct('category', publicFilter()),
    ])
    res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)), featured, categories: categories.filter(Boolean) })
  }),
)

router.get(
  '/:slug/comments',
  asyncHandler(async (req, res) => {
    const post = await BlogPost.findOne({ slug: req.params.slug, ...publicFilter() })
      .select('allowComments')
      .lean()
    if (!post) throw new HttpError(404, 'Article not found')
    if (!post.allowComments) return res.json({ items: [], commentsOpen: false })
    const items = await BlogComment.find({ postId: post._id, status: 'Approved' })
      .select('name body createdAt')
      .sort({ createdAt: -1 })
      .lean()
    res.json({ items, commentsOpen: true })
  }),
)

router.post(
  '/:slug/comments',
  blogCommentLimiter,
  asyncHandler(async (req, res) => {
    const post = await BlogPost.findOne({ slug: req.params.slug, ...publicFilter() }).select('allowComments')
    if (!post) throw new HttpError(404, 'Article not found')
    if (!post.allowComments) throw new HttpError(403, 'Comments are closed for this article')
    const name = String(req.body?.name || '').trim()
    const email = String(req.body?.email || '').trim().toLowerCase()
    const body = String(req.body?.body || '').trim()
    if (!name || !email || !body) throw new HttpError(400, 'Name, email and comment are required')
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(400, 'Enter a valid email address')
    await BlogComment.create({ postId: post._id, name, email, body })
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
  const ids = [
    post.imageMediaId,
    ...(post.body || []).map((block) => block.mediaId),
  ].filter(Boolean)
  if (!ids.length) return post

  const media = await Media.find({ _id: { $in: ids } }).select('url width height sizes').lean()
  const byId = new Map(media.map((row) => [String(row._id), row]))

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
    ...(cover ? { imageSrcset: srcsetFor(cover), imageWidth: cover.width, imageHeight: cover.height } : {}),
    body: (post.body || []).map((block) => {
      const row = block.mediaId && byId.get(String(block.mediaId))
      return row ? { ...block, srcset: srcsetFor(row) } : block
    }),
  }
}

router.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const found = await BlogPost.findOne({ slug: req.params.slug, ...publicFilter() }).select('-revisions').lean()
    if (!found) throw new HttpError(404, 'Article not found')
    const post = await withImageSources(found)
    const related = await BlogPost.find({
      _id: { $ne: post._id },
      category: post.category,
      ...publicFilter(),
    })
      .select('-body')
      .limit(3)
      .lean()
    res.json({ post, related })
  }),
)

export default router
