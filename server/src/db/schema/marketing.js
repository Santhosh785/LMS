import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { id, legacyId, timestamps } from './_common.js'
import { courses } from './courses.js'
import { users } from './users.js'

/* -------------------------------- email ---------------------------------- */

export const emailLists = pgTable('email_lists', {
  id: id(),
  legacyId: legacyId(),
  name: text().notNull(),
  description: text(),
  contactCount: integer().notNull().default(0),
  ...timestamps,
})

export const emailContacts = pgTable(
  'email_contacts',
  {
    id: id(),
    legacyId: legacyId(),
    name: text(),
    email: text().notNull(),
    status: text({ enum: ['Subscribed', 'Unsubscribed'] })
      .notNull()
      .default('Subscribed'),
    joinedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [index().on(t.email), index().on(t.status)],
)

/** Replaces EmailContact.listIds. */
export const emailContactLists = pgTable(
  'email_contact_lists',
  {
    contactId: uuid()
      .notNull()
      .references(() => emailContacts.id, { onDelete: 'cascade' }),
    listId: uuid()
      .notNull()
      .references(() => emailLists.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.contactId, t.listId] }), index().on(t.listId)],
)

export const broadcasts = pgTable(
  'broadcasts',
  {
    id: id(),
    legacyId: legacyId(),
    subject: text().notNull(),
    fromName: text().notNull().default('Growth Scholar'),
    sendToListId: uuid().references(() => emailLists.id, { onDelete: 'set null' }),
    sendToListName: text(),
    body: text(),
    status: text({ enum: ['draft', 'scheduled', 'sent'] })
      .notNull()
      .default('draft'),
    scheduledAt: timestamp({ withTimezone: true }),
    sentAt: timestamp({ withTimezone: true }),
    stats: jsonb().notNull().default({ delivered: 0, opened: 0, clicked: 0 }),
    ...timestamps,
  },
  (t) => [index().on(t.status, t.updatedAt.desc())],
)

/* ------------------------------- funnels --------------------------------- */

export const funnels = pgTable(
  'funnels',
  {
    id: id(),
    legacyId: legacyId(),
    name: text().notNull(),
    slug: text(),
    template: text({ enum: ['Lead Magnet', 'Video Series', 'Survey Funnel'] })
      .notNull()
      .default('Lead Magnet'),
    status: text({ enum: ['Live', 'Draft', 'Paused'] })
      .notNull()
      .default('Draft'),
    leadCount: integer().notNull().default(0),
    description: text(),
    domain: text(),
    automationRules: jsonb().notNull().default([]),
    ...timestamps,
  },
  (t) => [index().on(t.slug), index().on(t.status)],
)

export const funnelSteps = pgTable(
  'funnel_steps',
  {
    id: id(),
    legacyId: legacyId(),
    funnelId: uuid()
      .notNull()
      .references(() => funnels.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    order: integer().notNull().default(0),
    url: text(),
    uniqueVisitors: integer().notNull().default(0),
    totalViews: integer().notNull().default(0),
    conversionPct: doublePrecision().notNull().default(0),
    ...timestamps,
  },
  (t) => [index().on(t.funnelId, t.order)],
)

export const funnelLeads = pgTable(
  'funnel_leads',
  {
    id: id(),
    legacyId: legacyId(),
    funnelId: uuid().references(() => funnels.id, { onDelete: 'cascade' }),
    name: text(),
    email: text().notNull(),
    phone: text(),
    sourceStep: text(),
    date: timestamp({ withTimezone: true }).notNull().defaultNow(),
    status: text({ enum: ['New', 'Nurture', 'Purchased', 'Unsubscribed'] })
      .notNull()
      .default('New'),
    ...timestamps,
  },
  (t) => [index().on(t.funnelId), index().on(t.status)],
)

/* ----------------------------- gamification ------------------------------ */

export const badges = pgTable('badges', {
  id: id(),
  legacyId: legacyId(),
  name: text().notNull(),
  icon: text().notNull().default('🛡'),
  tone: text().notNull().default('gold'),
  description: text(),
  automationEnabled: boolean().notNull().default(false),
  assignWhen: text({ enum: ['Seeds points', 'Select course / service'] })
    .notNull()
    .default('Seeds points'),
  seedsThreshold: integer().notNull().default(0),
  courseId: uuid().references(() => courses.id, { onDelete: 'set null' }),
  holderCount: integer().notNull().default(0),
  ...timestamps,
})

export const pointRules = pgTable('point_rules', {
  id: id(),
  legacyId: legacyId(),
  activity: text().notNull(),
  points: integer().notNull().default(0),
  order: integer().notNull().default(0),
  enabled: boolean().notNull().default(true),
  ...timestamps,
})

export const leaderboardEntries = pgTable(
  'leaderboard_entries',
  {
    id: id(),
    legacyId: legacyId(),
    rank: integer().notNull(),
    userId: uuid().references(() => users.id, { onDelete: 'cascade' }),
    name: text(),
    email: text(),
    badge: text().notNull().default('—'),
    points: integer().notNull().default(0),
    service: text(),
    period: text({ enum: ['week', 'month', 'all'] })
      .notNull()
      .default('week'),
    board: text().notNull().default('Growth Master'),
    ...timestamps,
  },
  (t) => [index().on(t.period), index().on(t.board, t.period, t.rank)],
)
