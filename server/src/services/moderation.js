import { and, eq, gt, or, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { isUuid } from '../db/coerce.js'
import { blocks, comments, posts } from '../db/schema/index.js'

/**
 * Community moderation.
 *
 * The authorization rule lives here rather than in each route so it cannot be
 * half-applied: **every delete verifies ownership or admin role server-side.**
 * Hiding a delete button in the UI is not access control — user A must get a 403
 * calling the endpoint directly against user B's post, and that is what is
 * tested.
 */

export const canModerate = (user, doc) => {
  if (!user) return false
  // `authorId` may arrive populated ({ _id, name }) or as a bare id.
  const authorId = doc.authorId?._id || doc.authorId?.id || doc.authorId
  return user.role === 'admin' || String(authorId) === String(user.id || user._id)
}

/**
 * Deletes a post and everything hanging off it.
 *
 * Comments go with the post — by the foreign key's ON DELETE CASCADE now, so
 * the orphaning bug task 18 fixed on channel deletion cannot come back through
 * a code path that forgets to clean up.
 */
export async function deletePost(postId) {
  if (!isUuid(String(postId))) return null
  const [post] = await db
    .delete(posts)
    .where(eq(posts.id, String(postId)))
    .returning()
  return post || null
}

/** Deletes a comment and decrements its post's counter in the same transaction. */
export async function deleteComment(commentId) {
  if (!isUuid(String(commentId))) return null
  return db.transaction(async (tx) => {
    const [comment] = await tx
      .delete(comments)
      .where(eq(comments.id, String(commentId)))
      .returning()
    if (!comment) return null
    // Decremented in SQL and floored at zero: a counter that drifts negative
    // renders as "-1 comments" forever, and there is no natural moment to
    // repair it.
    await tx
      .update(posts)
      .set({ commentCount: sql`${posts.commentCount} - 1` })
      .where(and(eq(posts.id, comment.postId), gt(posts.commentCount, 0)))
    return comment
  })
}

/**
 * Every user id hidden from `userId` in either direction — people they blocked,
 * and people who blocked them. Returns an array suitable for `notInArray`.
 */
export async function hiddenAuthorIds(userId) {
  if (!userId) return []
  const rows = await db
    .select({ blockerId: blocks.blockerId, blockedId: blocks.blockedId })
    .from(blocks)
    .where(or(eq(blocks.blockerId, userId), eq(blocks.blockedId, userId)))

  const ids = new Set()
  for (const b of rows) {
    ids.add(String(b.blockerId) === String(userId) ? String(b.blockedId) : String(b.blockerId))
  }
  return [...ids]
}
