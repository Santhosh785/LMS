import { Router } from 'express'
import { body } from 'express-validator'
import { validate } from '../middleware/validate.js'
import { requireAuth } from '../middleware/auth.js'
import { reportLimiter } from '../middleware/rateLimit.js'
import { asyncHandler, HttpError } from '../middleware/error.js'
import { Block, Channel, Post, Comment, Report, User } from '../models/index.js'
import { canModerate, deleteComment, deletePost, hiddenAuthorIds } from '../services/moderation.js'

const router = Router()

const AUTHOR_FIELDS = 'name avatarInitials role'

/** Excludes anyone this viewer has blocked, or who has blocked them. */
const visibilityFilter = async (req) => {
  const hidden = await hiddenAuthorIds(req.user?._id)
  return hidden.length ? { authorId: { $nin: hidden } } : {}
}

router.get(
  '/channels',
  asyncHandler(async (_req, res) => {
    const channels = await Channel.find().sort({ group: 1, order: 1 }).lean()
    // grouped exactly as the original sidebar rendered them
    const order = ['Yoda Class Cohort', 'Growth Scholar Hub', 'Group Chats']
    const groups = order
      .map((name) => ({ name, channels: channels.filter((c) => c.group === name) }))
      .filter((g) => g.channels.length)
    res.json({ channels, groups })
  }),
)

router.get(
  '/channels/:slug/posts',
  asyncHandler(async (req, res) => {
    const channel = await Channel.findOne({ slug: req.params.slug }).lean()
    if (!channel) throw new HttpError(404, 'Channel not found')
    const posts = await Post.find({ channelId: channel._id, ...(await visibilityFilter(req)) })
      .populate('authorId', AUTHOR_FIELDS)
      .sort({ pinned: -1, createdAt: -1 })
      .lean()
    res.json({ channel, posts })
  }),
)

/** The main feed — posts across every channel. */
router.get(
  '/feed',
  asyncHandler(async (req, res) => {
    const posts = await Post.find(await visibilityFilter(req))
      .populate('authorId', AUTHOR_FIELDS)
      .populate('channelId', 'name slug')
      .sort({ pinned: -1, createdAt: -1 })
      .limit(50)
      .lean()
    res.json({ posts })
  }),
)

router.post(
  '/posts',
  requireAuth,
  body('body').trim().notEmpty().withMessage('Write something first'),
  validate,
  asyncHandler(async (req, res) => {
    let channelId = req.body.channelId
    if (!channelId && req.body.channelSlug) {
      const channel = await Channel.findOne({ slug: req.body.channelSlug }).lean()
      channelId = channel?._id
    }
    const post = await Post.create({
      channelId,
      authorId: req.user._id,
      body: req.body.body,
      attachments: req.body.attachments,
    })
    res.status(201).json(await post.populate('authorId', AUTHOR_FIELDS))
  }),
)

router.post(
  '/posts/:id/like',
  requireAuth,
  asyncHandler(async (req, res) => {
    const post = await Post.findById(req.params.id)
    if (!post) throw new HttpError(404, 'Post not found')
    const idx = post.likes.findIndex((id) => String(id) === String(req.user._id))
    if (idx >= 0) post.likes.splice(idx, 1)
    else post.likes.push(req.user._id)
    await post.save()
    res.json({ likes: post.likes.length, liked: idx < 0 })
  }),
)

router.get(
  '/posts/:id/comments',
  asyncHandler(async (req, res) => {
    const items = await Comment.find({ postId: req.params.id, ...(await visibilityFilter(req)) })
      .populate('authorId', AUTHOR_FIELDS)
      .sort({ createdAt: 1 })
      .lean()
    res.json({ items })
  }),
)

router.post(
  '/posts/:id/comments',
  requireAuth,
  body('body').trim().notEmpty().withMessage('Comment cannot be empty'),
  validate,
  asyncHandler(async (req, res) => {
    const post = await Post.findById(req.params.id)
    if (!post) throw new HttpError(404, 'Post not found')
    const comment = await Comment.create({
      postId: post._id,
      authorId: req.user._id,
      body: req.body.body,
    })
    // $inc, not read-modify-write: two comments posted at once would otherwise
    // both read the same count and save the same +1.
    await Post.updateOne({ _id: post._id }, { $inc: { commentCount: 1 } })
    res.status(201).json(await comment.populate('authorId', AUTHOR_FIELDS))
  }),
)

/* ------------------------------ moderation ------------------------------- */

/**
 * Delete a post. Author or admin only, **checked here on the server**.
 *
 * Before this endpoint existed there was no way to remove a post at all — not
 * for an admin, not even for its own author — so the first abusive or
 * defamatory post could only be taken down with a direct database edit.
 */
router.delete(
  '/posts/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const post = await Post.findById(req.params.id)
    if (!post) throw new HttpError(404, 'Post not found')
    if (!canModerate(req.user, post)) {
      throw new HttpError(403, 'You can only delete your own posts')
    }
    await deletePost(post._id)
    res.json({ ok: true })
  }),
)

/** Delete a comment. Author or admin only. */
router.delete(
  '/comments/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const comment = await Comment.findById(req.params.id)
    if (!comment) throw new HttpError(404, 'Comment not found')
    if (!canModerate(req.user, comment)) {
      throw new HttpError(403, 'You can only delete your own comments')
    }
    await deleteComment(comment._id)
    res.json({ ok: true })
  }),
)

/**
 * Report a post or comment for a moderator to review.
 *
 * Rate-limited, because reporting is trivially abusable as a harassment tool —
 * a handful of accounts can otherwise bury a moderator in reports about one
 * person. The unique index on (target, reporter) stops the simpler version of
 * the same trick.
 */
router.post(
  '/reports',
  requireAuth,
  reportLimiter,
  body('targetType').isIn(['post', 'comment']).withMessage('Say what is being reported'),
  body('targetId').notEmpty().withMessage('Nothing was selected'),
  body('reason')
    .optional()
    .isIn(['spam', 'harassment', 'hate', 'sexual', 'misinformation', 'other']),
  body('note').optional().trim().isLength({ max: 1000 }),
  validate,
  asyncHandler(async (req, res) => {
    const { targetType, targetId, reason, note } = req.body

    const Model = targetType === 'post' ? Post : Comment
    const target = await Model.findById(targetId).lean()
    if (!target) throw new HttpError(404, 'That content no longer exists')

    if (String(target.authorId) === String(req.user._id)) {
      throw new HttpError(400, 'You cannot report your own content')
    }

    try {
      await Report.create({
        targetType,
        targetId,
        reporterId: req.user._id,
        authorId: target.authorId,
        reason: reason || 'other',
        note,
        // A copy of the text, so a moderator can still judge content whose
        // author deletes it the moment it is reported.
        excerpt: String(target.body || '').slice(0, 500),
      })
    } catch (err) {
      // Already reported by this person. Answer as though it worked — telling
      // them otherwise just invites a second attempt.
      if (err?.code !== 11000) throw err
    }

    res.status(201).json({ ok: true, message: 'Thanks — a moderator will take a look.' })
  }),
)

/* -------------------------------- blocking ------------------------------- */

router.get(
  '/blocks',
  requireAuth,
  asyncHandler(async (req, res) => {
    const blocks = await Block.find({ blockerId: req.user._id })
      .populate('blockedId', AUTHOR_FIELDS)
      .sort({ createdAt: -1 })
      .lean()
    res.json({ items: blocks })
  }),
)

/**
 * Block another member. Their posts and comments disappear from this member's
 * feed, and this member's disappear from theirs — so blocking cannot be used to
 * keep watching someone who can no longer see you.
 *
 * The blocked party is not notified. Telling them is what turns a quiet exit
 * from a conversation into an escalation.
 */
router.post(
  '/blocks',
  requireAuth,
  body('userId').notEmpty().withMessage('Nobody was selected'),
  validate,
  asyncHandler(async (req, res) => {
    if (String(req.body.userId) === String(req.user._id)) {
      throw new HttpError(400, 'You cannot block yourself')
    }
    const target = await User.exists({ _id: req.body.userId })
    if (!target) throw new HttpError(404, 'That member does not exist')

    await Block.findOneAndUpdate(
      { blockerId: req.user._id, blockedId: req.body.userId },
      { $setOnInsert: { blockerId: req.user._id, blockedId: req.body.userId } },
      { upsert: true },
    )
    res.status(201).json({ ok: true })
  }),
)

router.delete(
  '/blocks/:userId',
  requireAuth,
  asyncHandler(async (req, res) => {
    await Block.deleteOne({ blockerId: req.user._id, blockedId: req.params.userId })
    res.json({ ok: true })
  }),
)

export default router
