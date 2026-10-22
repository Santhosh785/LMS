import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import { id, legacyId, timestamps } from './_common.js'
import { users } from './users.js'

export const channels = pgTable(
  'channels',
  {
    id: id(),
    legacyId: legacyId(),
    name: text().notNull(),
    slug: text().notNull().unique(),
    group: text({ enum: ['Yoda Class Cohort', 'Growth Scholar Hub', 'Group Chats'] })
      .notNull()
      .default('Growth Scholar Hub'),
    description: text(),
    order: integer().notNull().default(0),
    ...timestamps,
  },
  (t) => [index().on(t.group)],
)

/** Replaces Channel.memberIds. */
export const channelMembers = pgTable(
  'channel_members',
  {
    channelId: uuid()
      .notNull()
      .references(() => channels.id, { onDelete: 'cascade' }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.channelId, t.userId] }), index().on(t.userId)],
)

export const posts = pgTable(
  'posts',
  {
    id: id(),
    legacyId: legacyId(),
    channelId: uuid().references(() => channels.id, { onDelete: 'cascade' }),
    authorId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    body: text().notNull(),
    attachments: jsonb().notNull().default([]),
    commentCount: integer().notNull().default(0),
    pinned: boolean().notNull().default(false),
    ...timestamps,
  },
  (t) => [index().on(t.channelId, t.createdAt.desc()), index().on(t.authorId)],
)

/** Replaces Post.likes. */
export const postLikes = pgTable(
  'post_likes',
  {
    postId: uuid()
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.postId, t.userId] })],
)

export const comments = pgTable(
  'comments',
  {
    id: id(),
    legacyId: legacyId(),
    postId: uuid()
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    authorId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    body: text().notNull(),
    ...timestamps,
  },
  (t) => [index().on(t.postId, t.createdAt)],
)

export const REPORT_REASONS = ['spam', 'harassment', 'hate', 'sexual', 'misinformation', 'other']

/**
 * `targetId` is polymorphic (a post or a comment, per `targetType`), so it
 * carries no foreign key. A report must also outlive the content it is about:
 * the moderation history is the record of why something was removed.
 */
export const reports = pgTable(
  'reports',
  {
    id: id(),
    legacyId: legacyId(),
    targetType: text({ enum: ['post', 'comment'] }).notNull(),
    targetId: uuid().notNull(),
    reporterId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    authorId: uuid().references(() => users.id, { onDelete: 'set null' }),
    reason: text({ enum: REPORT_REASONS }).notNull().default('other'),
    note: text(),
    excerpt: text(),
    status: text({ enum: ['open', 'actioned', 'dismissed'] })
      .notNull()
      .default('open'),
    resolvedAt: timestamp({ withTimezone: true }),
    resolvedBy: uuid().references(() => users.id, { onDelete: 'set null' }),
    resolution: text(),
    ...timestamps,
  },
  (t) => [
    unique().on(t.targetId, t.reporterId),
    index().on(t.reporterId),
    index().on(t.status, t.createdAt.desc()),
  ],
)

export const blocks = pgTable(
  'blocks',
  {
    id: id(),
    legacyId: legacyId(),
    blockerId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    blockedId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => [unique().on(t.blockerId, t.blockedId), index().on(t.blockedId)],
)
