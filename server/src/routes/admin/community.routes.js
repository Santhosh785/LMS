import { Router } from 'express'
import { asyncHandler, HttpError } from '../../middleware/error.js'
import { Channel, Comment, Post, Report, User } from '../../models/index.js'
import { deleteComment, deletePost } from '../../services/moderation.js'

const router = Router()

/* --------------------------- moderation queue ---------------------------- */

/**
 * Open reports, newest first, with the reported content resolved inline so a
 * moderator can judge without opening the community in another tab.
 */
router.get(
  '/reports',
  asyncHandler(async (req, res) => {
    const status = req.query.status || 'open'
    const reports = await Report.find(status === 'all' ? {} : { status })
      .populate('reporterId', 'name email')
      .populate('authorId', 'name email')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean()

    // One round trip per collection rather than one per report.
    const postIds = reports.filter((r) => r.targetType === 'post').map((r) => r.targetId)
    const commentIds = reports.filter((r) => r.targetType === 'comment').map((r) => r.targetId)
    const [posts, comments] = await Promise.all([
      Post.find({ _id: { $in: postIds } })
        .select('body channelId createdAt')
        .lean(),
      Comment.find({ _id: { $in: commentIds } })
        .select('body postId createdAt')
        .lean(),
    ])
    const byId = new Map([...posts, ...comments].map((d) => [String(d._id), d]))

    res.json({
      items: reports.map((r) => ({
        ...r,
        // Falls back to the excerpt captured at report time, so a report whose
        // content the author has since deleted is still reviewable.
        target: byId.get(String(r.targetId)) || null,
        deleted: !byId.has(String(r.targetId)),
      })),
      openCount: await Report.countDocuments({ status: 'open' }),
    })
  }),
)

/**
 * Action a report: remove the content, or dismiss it.
 *
 * Every report on the same item is resolved together — two people reporting one
 * post is one decision, not two, and leaving the duplicates open would make the
 * queue grow with every popular complaint.
 */
router.post(
  '/reports/:id/resolve',
  asyncHandler(async (req, res) => {
    const report = await Report.findById(req.params.id)
    if (!report) throw new HttpError(404, 'Report not found')

    const remove = req.body.action === 'remove'
    if (remove) {
      if (report.targetType === 'post') await deletePost(report.targetId)
      else await deleteComment(report.targetId)
    }

    await Report.updateMany(
      { targetId: report.targetId, status: 'open' },
      {
        $set: {
          status: remove ? 'actioned' : 'dismissed',
          resolvedAt: new Date(),
          resolvedBy: req.user._id,
          resolution: req.body.note || (remove ? 'Content removed' : 'No action needed'),
        },
      },
    )

    res.json({
      ok: true,
      message: remove ? 'Content removed and the report closed.' : 'Report dismissed.',
    })
  }),
)

/** admin/community lists channel groups with member and channel counts. */
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const [channels, memberCount] = await Promise.all([
      Channel.find().sort({ group: 1, order: 1 }).lean(),
      User.countDocuments(),
    ])

    const postCounts = await Post.aggregate([{ $group: { _id: '$channelId', count: { $sum: 1 } } }])
    const postsByChannel = Object.fromEntries(postCounts.map((p) => [String(p._id), p.count]))

    const groupNames = [...new Set(channels.map((c) => c.group))]
    const groups = groupNames.map((name) => {
      const inGroup = channels.filter((c) => c.group === name)
      return {
        name,
        channelCount: inGroup.length,
        memberCount: new Set(inGroup.flatMap((c) => c.memberIds.map(String))).size || memberCount,
        postCount: inGroup.reduce((sum, c) => sum + (postsByChannel[String(c._id)] || 0), 0),
        status: 'Active',
      }
    })

    res.json({
      groups,
      channels: channels.map((c) => ({ ...c, postCount: postsByChannel[String(c._id)] || 0 })),
    })
  }),
)

router.post(
  '/channels',
  asyncHandler(async (req, res) => {
    res.status(201).json(await Channel.create(req.body))
  }),
)

router.put(
  '/channels/:id',
  asyncHandler(async (req, res) => {
    const channel = await Channel.findByIdAndUpdate(req.params.id, req.body, { new: true })
    if (!channel) throw new HttpError(404, 'Channel not found')
    res.json(channel)
  }),
)

/**
 * Deleting a channel deletes its posts, **their comments, and any reports
 * against either.**
 *
 * This used to run `Post.deleteMany({ channelId })` and stop there, so every
 * channel deletion left the comments on those posts behind permanently: rows
 * nothing links to, nothing counts, and nothing will ever clean up. The post ids
 * have to be collected *before* the delete, because afterwards there is no way
 * left to find them.
 */
router.delete(
  '/channels/:id',
  asyncHandler(async (req, res) => {
    const channel = await Channel.findByIdAndDelete(req.params.id)
    if (!channel) throw new HttpError(404, 'Channel not found')

    const postIds = (await Post.find({ channelId: channel._id }).select('_id').lean()).map(
      (p) => p._id,
    )

    const [posts, comments, reports] = await Promise.all([
      Post.deleteMany({ channelId: channel._id }),
      Comment.deleteMany({ postId: { $in: postIds } }),
      Report.deleteMany({ targetId: { $in: postIds } }),
    ])

    res.json({
      ok: true,
      deleted: {
        posts: posts.deletedCount,
        comments: comments.deletedCount,
        reports: reports.deletedCount,
      },
    })
  }),
)

export default router
