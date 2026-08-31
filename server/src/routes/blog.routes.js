import { Router } from 'express'
import { asyncHandler, HttpError } from '../middleware/error.js'
import BlogPost from '../models/BlogPost.js'

const router = Router()

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter = {}
    // "latest" is the catch-all tab in the original category rail
    if (req.query.category && req.query.category !== 'latest') {
      filter.category = req.query.category
    }
    const limit = Math.min(Number(req.query.limit) || 50, 100)
    const [items, featured, categories] = await Promise.all([
      BlogPost.find(filter).select('-body').sort({ publishedAt: -1 }).limit(limit).lean(),
      BlogPost.find({ featured: true }).select('-body').sort({ publishedAt: -1 }).lean(),
      BlogPost.distinct('category'),
    ])
    res.json({ items, featured, categories: categories.filter(Boolean) })
  }),
)

router.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const post = await BlogPost.findOne({ slug: req.params.slug }).lean()
    if (!post) throw new HttpError(404, 'Article not found')
    const related = await BlogPost.find({
      _id: { $ne: post._id },
      category: post.category,
    })
      .select('-body')
      .limit(3)
      .lean()
    res.json({ post, related })
  }),
)

export default router
