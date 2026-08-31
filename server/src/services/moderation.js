import { Block, Comment, Post } from '../models/index.js'

/**
 * Community moderation.
 *
 * The authorization rule lives here rather than in each route so it cannot be
 * half-applied: **every delete verifies ownership or admin role server-side.**
 * Hiding a delete button in the UI is not access control — user A must get a 403
 * calling the endpoint directly against user B's post, and that is what is
 * tested.
 */

export const canModerate = (user, doc) =>
  Boolean(user) && (user.role === 'admin' || String(doc.authorId) === String(user._id))

/**
 * Deletes a post and everything hanging off it.
 *
 * Comments go with the post. Leaving them behind is the same orphaning bug task
 * 18 fixes on channel deletion: rows nothing can reach, counted by nothing,
 * cleaned up by nobody.
 */
export async function deletePost(postId) {
  const post = await Post.findByIdAndDelete(postId)
  if (!post) return null
  await Comment.deleteMany({ postId: post._id })
  return post
}

/** Deletes a comment and decrements its post's counter atomically. */
export async function deleteComment(commentId) {
  const comment = await Comment.findByIdAndDelete(commentId)
  if (!comment) return null
  // $inc, and floored at zero: a counter that drifts negative renders as
  // "-1 comments" forever, and there is no natural moment to repair it.
  await Post.updateOne(
    { _id: comment.postId, commentCount: { $gt: 0 } },
    { $inc: { commentCount: -1 } },
  )
  return comment
}

/**
 * Every user id hidden from `userId` in either direction — people they blocked,
 * and people who blocked them. Returns an array suitable for `$nin`.
 */
export async function hiddenAuthorIds(userId) {
  if (!userId) return []
  const blocks = await Block.find({
    $or: [{ blockerId: userId }, { blockedId: userId }],
  })
    .select('blockerId blockedId')
    .lean()

  const ids = new Set()
  for (const b of blocks) {
    ids.add(String(b.blockerId) === String(userId) ? String(b.blockedId) : String(b.blockerId))
  }
  return [...ids]
}
