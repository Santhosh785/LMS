import { Router } from 'express'
import { asyncHandler, HttpError } from '../../middleware/error.js'
import { and, asc, count, desc, eq, inArray, isNotNull } from 'drizzle-orm'
import { db, withMongoId } from '../../db/index.js'
import { coerce, isUuid } from '../../db/coerce.js'
import { channels, comments, posts, reports, users } from '../../db/schema/index.js'
import { channelDocs } from '../../db/repos/community.js'
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
    const rows = await db
      .select()
      .from(reports)
      .where(status === 'all' ? undefined : eq(reports.status, status))
      .orderBy(desc(reports.createdAt))
      .limit(200)

    // One round trip per table rather than one per report.
    const postIds = rows.filter((r) => r.targetType === 'post').map((r) => r.targetId)
    const commentIds = rows.filter((r) => r.targetType === 'comment').map((r) => r.targetId)
    const peopleIds = [...new Set(rows.flatMap((r) => [r.reporterId, r.authorId]).filter(Boolean))]
    const [postRows, commentRows, people, [{ open }]] = await Promise.all([
      postIds.length
        ? db
            .select({
              id: posts.id,
              body: posts.body,
              channelId: posts.channelId,
              createdAt: posts.createdAt,
            })
            .from(posts)
            .where(inArray(posts.id, postIds))
        : [],
      commentIds.length
        ? db
            .select({
              id: comments.id,
              body: comments.body,
              postId: comments.postId,
              createdAt: comments.createdAt,
            })
            .from(comments)
            .where(inArray(comments.id, commentIds))
        : [],
      peopleIds.length
        ? db
            .select({ id: users.id, name: users.name, email: users.email })
            .from(users)
            .where(inArray(users.id, peopleIds))
        : [],
      db.select({ open: count() }).from(reports).where(eq(reports.status, 'open')),
    ])
    const byId = new Map([...postRows, ...commentRows].map((d) => [String(d.id), withMongoId(d)]))
    const personById = new Map(people.map((p) => [p.id, withMongoId(p)]))

    res.json({
      items: rows.map((r) =>
        withMongoId({
          ...r,
          reporterId: personById.get(r.reporterId) || null,
          authorId: personById.get(r.authorId) || null,
          // Falls back to the excerpt captured at report time, so a report whose
          // content the author has since deleted is still reviewable.
          target: byId.get(String(r.targetId)) || null,
          deleted: !byId.has(String(r.targetId)),
        }),
      ),
      openCount: open,
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
    const [report] = isUuid(req.params.id)
      ? await db.select().from(reports).where(eq(reports.id, req.params.id))
      : []
    if (!report) throw new HttpError(404, 'Report not found')

    const remove = req.body.action === 'remove'
    if (remove) {
      if (report.targetType === 'post') await deletePost(report.targetId)
      else await deleteComment(report.targetId)
    }

    await db
      .update(reports)
      .set({
        status: remove ? 'actioned' : 'dismissed',
        resolvedAt: new Date(),
        resolvedBy: req.user.id,
        resolution: req.body.note || (remove ? 'Content removed' : 'No action needed'),
      })
      .where(and(eq(reports.targetId, report.targetId), eq(reports.status, 'open')))

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
    const [list, [{ memberCount }], postCounts] = await Promise.all([
      db
        .select()
        .from(channels)
        .orderBy(asc(channels.group), asc(channels.order))
        .then(channelDocs),
      db.select({ memberCount: count() }).from(users),
      db
        .select({ channelId: posts.channelId, n: count() })
        .from(posts)
        .where(isNotNull(posts.channelId))
        .groupBy(posts.channelId),
    ])
    const postsByChannel = Object.fromEntries(postCounts.map((p) => [String(p.channelId), p.n]))

    const groupNames = [...new Set(list.map((c) => c.group))]
    const groups = groupNames.map((name) => {
      const inGroup = list.filter((c) => c.group === name)
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
      channels: list.map((c) => ({ ...c, postCount: postsByChannel[String(c._id)] || 0 })),
    })
  }),
)

router.post(
  '/channels',
  asyncHandler(async (req, res) => {
    const [row] = await db.insert(channels).values(coerce(channels, req.body)).returning()
    res.status(201).json((await channelDocs([row]))[0])
  }),
)

router.put(
  '/channels/:id',
  asyncHandler(async (req, res) => {
    if (!isUuid(req.params.id)) throw new HttpError(404, 'Channel not found')
    const values = coerce(channels, req.body)
    const [channel] = Object.keys(values).length
      ? await db.update(channels).set(values).where(eq(channels.id, req.params.id)).returning()
      : await db.select().from(channels).where(eq(channels.id, req.params.id))
    if (!channel) throw new HttpError(404, 'Channel not found')
    res.json((await channelDocs([channel]))[0])
  }),
)

/**
 * Deleting a channel deletes its posts, **their comments, and any reports
 * against either.**
 *
 * Posts and comments go by the foreign keys' ON DELETE CASCADE. Reports are
 * polymorphic (no foreign key), so they are deleted explicitly — and the post
 * and comment ids have to be collected *before* the cascade, because afterwards
 * there is no way left to find them. One transaction, so a failure leaves the
 * channel and everything under it intact.
 */
router.delete(
  '/channels/:id',
  asyncHandler(async (req, res) => {
    if (!isUuid(req.params.id)) throw new HttpError(404, 'Channel not found')

    const deleted = await db.transaction(async (tx) => {
      const [channel] = await tx.select().from(channels).where(eq(channels.id, req.params.id))
      if (!channel) return null

      const postIds = (
        await tx.select({ id: posts.id }).from(posts).where(eq(posts.channelId, channel.id))
      ).map((p) => p.id)
      const commentIds = postIds.length
        ? (
            await tx
              .select({ id: comments.id })
              .from(comments)
              .where(inArray(comments.postId, postIds))
          ).map((c) => c.id)
        : []

      const targets = [...postIds, ...commentIds]
      const removedReports = targets.length
        ? await tx
            .delete(reports)
            .where(inArray(reports.targetId, targets))
            .returning({ id: reports.id })
        : []

      await tx.delete(channels).where(eq(channels.id, channel.id))
      return {
        posts: postIds.length,
        comments: commentIds.length,
        reports: removedReports.length,
      }
    })
    if (!deleted) throw new HttpError(404, 'Channel not found')

    res.json({ ok: true, deleted })
  }),
)

export default router
