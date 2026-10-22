import { Router } from 'express'
import { body } from 'express-validator'
import { validate } from '../middleware/validate.js'
import { requireAuth } from '../middleware/auth.js'
import { reportLimiter } from '../middleware/rateLimit.js'
import { asyncHandler, HttpError } from '../middleware/error.js'
import { and, asc, desc, eq, notInArray, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { isUuid } from '../db/coerce.js'
import { blocks, channels, comments, postLikes, posts, reports } from '../db/schema/index.js'
import { channelDocs, populateAuthors, postDocs } from '../db/repos/community.js'
import { findUserById } from '../db/repos/users.js'
import { canModerate, deleteComment, deletePost, hiddenAuthorIds } from '../services/moderation.js'

const router = Router()

/** Excludes anyone this viewer has blocked, or who has blocked them. */
const visibilityFilter = async (req, column) => {
  const hidden = await hiddenAuthorIds(req.user?.id)
  return hidden.length ? notInArray(column, hidden) : undefined
}

const findPost = async (id) => {
  if (!isUuid(id)) return null
  const [row] = await db.select().from(posts).where(eq(posts.id, id))
  return row || null
}

const findComment = async (id) => {
  if (!isUuid(id)) return null
  const [row] = await db.select().from(comments).where(eq(comments.id, id))
  return row || null
}

router.get(
  '/channels',
  asyncHandler(async (_req, res) => {
    const list = await channelDocs(
      await db.select().from(channels).orderBy(asc(channels.group), asc(channels.order)),
    )
    // grouped exactly as the original sidebar rendered them
    const order = ['Yoda Class Cohort', 'Growth Scholar Hub', 'Group Chats']
    const groups = order
      .map((name) => ({ name, channels: list.filter((c) => c.group === name) }))
      .filter((g) => g.channels.length)
    res.json({ channels: list, groups })
  }),
)

router.get(
  '/channels/:slug/posts',
  asyncHandler(async (req, res) => {
    const [channel] = await db
      .select()
      .from(channels)
      .where(eq(channels.slug, String(req.params.slug).toLowerCase()))
    if (!channel) throw new HttpError(404, 'Channel not found')
    const rows = await db
      .select()
      .from(posts)
      .where(and(eq(posts.channelId, channel.id), await visibilityFilter(req, posts.authorId)))
      .orderBy(desc(posts.pinned), desc(posts.createdAt))
    res.json({ channel: (await channelDocs([channel]))[0], posts: await postDocs(rows) })
  }),
)

/** The main feed — posts across every channel. */
router.get(
  '/feed',
  asyncHandler(async (req, res) => {
    const rows = await db
      .select()
      .from(posts)
      .where(await visibilityFilter(req, posts.authorId))
      .orderBy(desc(posts.pinned), desc(posts.createdAt))
      .limit(50)
    res.json({ posts: await postDocs(rows, { withChannel: true }) })
  }),
)

router.post(
  '/posts',
  requireAuth,
  body('body').trim().notEmpty().withMessage('Write something first'),
  validate,
  asyncHandler(async (req, res) => {
    let channelId = isUuid(req.body.channelId) ? req.body.channelId : null
    if (!channelId && req.body.channelSlug) {
      const [channel] = await db
        .select({ id: channels.id })
        .from(channels)
        .where(eq(channels.slug, String(req.body.channelSlug).toLowerCase()))
      channelId = channel?.id || null
    }
    const [post] = await db
      .insert(posts)
      .values({
        channelId,
        authorId: req.user.id,
        body: req.body.body,
        attachments: Array.isArray(req.body.attachments) ? req.body.attachments : [],
      })
      .returning()
    res.status(201).json((await postDocs([post]))[0])
  }),
)

router.post(
  '/posts/:id/like',
  requireAuth,
  asyncHandler(async (req, res) => {
    const post = await findPost(req.params.id)
    if (!post) throw new HttpError(404, 'Post not found')
    // A toggle as two set operations rather than read-modify-write: try to
    // remove the like; if there was none, add it. A double-tap can no longer
    // save a stale array over a concurrent like from someone else.
    const mine = and(eq(postLikes.postId, post.id), eq(postLikes.userId, req.user.id))
    const removed = await db.delete(postLikes).where(mine).returning()
    if (!removed.length) {
      await db
        .insert(postLikes)
        .values({ postId: post.id, userId: req.user.id })
        .onConflictDoNothing()
    }
    const [{ n }] = await db
      .select({ n: sql`count(*)::int` })
      .from(postLikes)
      .where(eq(postLikes.postId, post.id))
    res.json({ likes: n, liked: !removed.length })
  }),
)

router.get(
  '/posts/:id/comments',
  asyncHandler(async (req, res) => {
    if (!isUuid(req.params.id)) return res.json({ items: [] })
    const rows = await db
      .select()
      .from(comments)
      .where(
        and(eq(comments.postId, req.params.id), await visibilityFilter(req, comments.authorId)),
      )
      .orderBy(asc(comments.createdAt))
    res.json({ items: await populateAuthors(rows) })
  }),
)

router.post(
  '/posts/:id/comments',
  requireAuth,
  body('body').trim().notEmpty().withMessage('Comment cannot be empty'),
  validate,
  asyncHandler(async (req, res) => {
    const post = await findPost(req.params.id)
    if (!post) throw new HttpError(404, 'Post not found')
    const comment = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(comments)
        .values({ postId: post.id, authorId: req.user.id, body: req.body.body })
        .returning()
      // Incremented in SQL, not read-modify-write: two comments posted at once
      // would otherwise both read the same count and save the same +1.
      await tx
        .update(posts)
        .set({ commentCount: sql`${posts.commentCount} + 1` })
        .where(eq(posts.id, post.id))
      return row
    })
    res.status(201).json((await populateAuthors([comment]))[0])
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
    const post = await findPost(req.params.id)
    if (!post) throw new HttpError(404, 'Post not found')
    if (!canModerate(req.user, post)) {
      throw new HttpError(403, 'You can only delete your own posts')
    }
    await deletePost(post.id)
    res.json({ ok: true })
  }),
)

/** Delete a comment. Author or admin only. */
router.delete(
  '/comments/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const comment = await findComment(req.params.id)
    if (!comment) throw new HttpError(404, 'Comment not found')
    if (!canModerate(req.user, comment)) {
      throw new HttpError(403, 'You can only delete your own comments')
    }
    await deleteComment(comment.id)
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

    const target = targetType === 'post' ? await findPost(targetId) : await findComment(targetId)
    if (!target) throw new HttpError(404, 'That content no longer exists')

    if (String(target.authorId) === String(req.user.id)) {
      throw new HttpError(400, 'You cannot report your own content')
    }

    // Already reported by this person: the unique (target, reporter) index
    // absorbs it. Answer as though it worked — telling them otherwise just
    // invites a second attempt.
    await db
      .insert(reports)
      .values({
        targetType,
        targetId: target.id,
        reporterId: req.user.id,
        authorId: target.authorId,
        reason: reason || 'other',
        note,
        // A copy of the text, so a moderator can still judge content whose
        // author deletes it the moment it is reported.
        excerpt: String(target.body || '').slice(0, 500),
      })
      .onConflictDoNothing({ target: [reports.targetId, reports.reporterId] })

    res.status(201).json({ ok: true, message: 'Thanks — a moderator will take a look.' })
  }),
)

/* -------------------------------- blocking ------------------------------- */

router.get(
  '/blocks',
  requireAuth,
  asyncHandler(async (req, res) => {
    const rows = await db
      .select()
      .from(blocks)
      .where(eq(blocks.blockerId, req.user.id))
      .orderBy(desc(blocks.createdAt))
    res.json({ items: await populateAuthors(rows, 'blockedId') })
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
    if (String(req.body.userId) === String(req.user.id)) {
      throw new HttpError(400, 'You cannot block yourself')
    }
    const target = await findUserById(req.body.userId)
    if (!target) throw new HttpError(404, 'That member does not exist')

    await db
      .insert(blocks)
      .values({ blockerId: req.user.id, blockedId: target.id })
      .onConflictDoNothing({ target: [blocks.blockerId, blocks.blockedId] })
    res.status(201).json({ ok: true })
  }),
)

router.delete(
  '/blocks/:userId',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (isUuid(req.params.userId)) {
      await db
        .delete(blocks)
        .where(and(eq(blocks.blockerId, req.user.id), eq(blocks.blockedId, req.params.userId)))
    }
    res.json({ ok: true })
  }),
)

export default router
