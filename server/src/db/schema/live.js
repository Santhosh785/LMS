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
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { id, legacyId, timestamps } from './_common.js'
import { courses, money } from './courses.js'
import { users } from './users.js'

export const liveClasses = pgTable(
  'live_classes',
  {
    id: id(),
    legacyId: legacyId(),
    title: text().notNull(),
    description: text(),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    durationMins: integer().notNull().default(60),
    host: text(),
    joinUrl: text(),
    courseId: uuid().references(() => courses.id, { onDelete: 'set null' }),
    status: text({ enum: ['Scheduled', 'Live', 'Ended'] })
      .notNull()
      .default('Scheduled'),
    kind: text().notNull().default('Workshop'),
    ...timestamps,
  },
  (t) => [index().on(t.startsAt)],
)

/** Replaces LiveClass.attendees. */
export const liveClassAttendees = pgTable(
  'live_class_attendees',
  {
    liveClassId: uuid()
      .notNull()
      .references(() => liveClasses.id, { onDelete: 'cascade' }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.liveClassId, t.userId] })],
)

export const bookings = pgTable(
  'bookings',
  {
    id: id(),
    legacyId: legacyId(),
    liveClassId: uuid()
      .notNull()
      .references(() => liveClasses.id, { onDelete: 'cascade' }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    slot: timestamp({ withTimezone: true }),
    status: text({ enum: ['Booked', 'Attended', 'Cancelled'] })
      .notNull()
      .default('Booked'),
    ...timestamps,
  },
  (t) => [unique().on(t.liveClassId, t.userId), index().on(t.userId)],
)

export const liveBookings = pgTable('live_bookings', {
  id: id(),
  legacyId: legacyId(),
  topic: text().notNull(),
  type: text({ enum: ['Single Session', 'Recurring Session'] })
    .notNull()
    .default('Single Session'),
  when: timestamp({ withTimezone: true }),
  timeZone: text().notNull().default('Asia/Kolkata'),
  maxRegistrants: integer().notNull().default(1),
  duration: text({ enum: ['30 Minutes', '45 Minutes', '60 Minutes'] })
    .notNull()
    .default('30 Minutes'),
  passwordProtected: boolean().notNull().default(false),
  password: text(),
  theme: text({ enum: ['Brand Green', 'Ocean', 'Warm Spotlight', 'Minimal Dark'] })
    .notNull()
    .default('Brand Green'),
  description: text(),
  bookedCount: integer().notNull().default(0),
  ...timestamps,
})

/** Landing-page copy is jsonb: it is rendered whole and never queried into. */
export const workshops = pgTable(
  'workshops',
  {
    id: id(),
    legacyId: legacyId(),
    title: text().notNull(),
    slug: text().notNull().unique(),
    mode: text({ enum: ['online', 'offline'] })
      .notNull()
      .default('online'),
    language: text(),
    categories: text().array().notNull().default([]),
    tags: text().array().notNull().default([]),
    level: text(),
    bannerTitle: text(),
    image: text(),
    imageAlt: text(),
    bannerClass: text().default('ws-seo'),
    priceNew: money().notNull().default(0),
    priceOld: money(),
    startsAt: timestamp({ withTimezone: true }),
    durationLabel: text(),
    venue: text(),
    host: text(),
    hostInitials: text(),
    capacity: integer().notNull().default(100),
    registeredCount: integer().notNull().default(0),
    landing: jsonb().notNull().default({}),
    ...timestamps,
  },
  (t) => [
    index().on(t.mode),
    index().on(t.language),
    index().using('gin', t.categories),
    index().using('gin', t.tags),
  ],
)

export const workshopRegistrations = pgTable(
  'workshop_registrations',
  {
    id: id(),
    legacyId: legacyId(),
    workshopId: uuid()
      .notNull()
      .references(() => workshops.id, { onDelete: 'cascade' }),
    userId: uuid().references(() => users.id, { onDelete: 'cascade' }),
    guestName: text(),
    guestEmail: text(),
    guestPhone: text(),
    attended: boolean().notNull().default(false),
    waitlisted: boolean().notNull().default(false),
    cancelledAt: timestamp({ withTimezone: true }),
    note: text(),
    ...timestamps,
  },
  (t) => [
    index().on(t.workshopId),
    index().on(t.attended),
    index().on(t.waitlisted),
    uniqueIndex('workshop_registrations_user_unique')
      .on(t.workshopId, t.userId)
      .where(sql`${t.userId} is not null`),
    uniqueIndex('workshop_registrations_guest_unique')
      .on(t.workshopId, t.guestEmail)
      .where(sql`${t.guestEmail} is not null`),
  ],
)
