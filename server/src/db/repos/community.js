import { inArray } from 'drizzle-orm'
import { db, withMongoId } from '../index.js'
import { channelMembers, channels, postLikes, users } from '../schema/index.js'

/**
 * Community rows as the documents the client renders.
 *
 * Three things Mongoose did for free come back here: `authorId` populated with
 * the author's display fields, `likes` and `memberIds` as id arrays (they are
 * join tables now), and — on the feed only — `channelId` populated with the
 * channel's name and slug.
 */
export const AUTHOR_FIELDS = {
  id: users.id,
  name: users.name,
  avatarInitials: users.avatarInitials,
  role: users.role,
}

/** id → { _id, name, avatarInitials, role } for every id given. */
export async function authorsById(ids, { tx = db } = {}) {
  const unique = [...new Set(ids.filter(Boolean))]
  if (!unique.length) return new Map()
  const rows = await tx.select(AUTHOR_FIELDS).from(users).where(inArray(users.id, unique))
  return new Map(rows.map((r) => [r.id, withMongoId(r)]))
}

/** Replaces `field` (an id) on each row with the populated author, or null. */
export async function populateAuthors(rows, field = 'authorId') {
  const authors = await authorsById(rows.map((r) => r[field]))
  return rows.map((r) => withMongoId({ ...r, [field]: authors.get(r[field]) || null }))
}

export async function postDocs(rows, { withChannel = false } = {}) {
  if (!rows.length) return []
  const ids = rows.map((r) => r.id)
  const channelIds = withChannel ? [...new Set(rows.map((r) => r.channelId).filter(Boolean))] : []
  const [authors, likes, chans] = await Promise.all([
    authorsById(rows.map((r) => r.authorId)),
    db.select().from(postLikes).where(inArray(postLikes.postId, ids)),
    channelIds.length
      ? db
          .select({ id: channels.id, name: channels.name, slug: channels.slug })
          .from(channels)
          .where(inArray(channels.id, channelIds))
      : [],
  ])
  const channelById = new Map(chans.map((c) => [c.id, withMongoId(c)]))
  return rows.map((r) =>
    withMongoId({
      ...r,
      authorId: authors.get(r.authorId) || null,
      ...(withChannel ? { channelId: channelById.get(r.channelId) || null } : {}),
      likes: likes.filter((l) => l.postId === r.id).map((l) => l.userId),
    }),
  )
}

export async function channelDocs(rows) {
  if (!rows.length) return []
  const members = await db
    .select()
    .from(channelMembers)
    .where(
      inArray(
        channelMembers.channelId,
        rows.map((r) => r.id),
      ),
    )
  return rows.map((r) =>
    withMongoId({
      ...r,
      memberIds: members.filter((m) => m.channelId === r.id).map((m) => m.userId),
    }),
  )
}
