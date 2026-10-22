import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'
import { ACCESS_PERIODS, id, legacyId, timestamps } from './_common.js'
import { users } from './users.js'

/** Rupees, not paise. Read back as a JS number, matching the Mongo documents. */
export const money = () => numeric({ precision: 12, scale: 2, mode: 'number' })

export const LESSON_CONTENT_TYPES = [
  'Video',
  'Audio',
  'E-book',
  'PDF',
  'Text',
  'Downloads',
  'Quiz',
  'Survey',
  'Assignment',
  'Live',
  'Custom Code',
  'SCORM/HTML',
]

/**
 * Courses. Curriculum and pricing plans are child tables, because enrollments,
 * the Bunny webhook and checkout all point into them. Marketing copy (journey,
 * FAQs, who-should-enroll) and the drip/automation rules are jsonb: they are
 * only ever read whole, alongside the course that owns them.
 */
export const courses = pgTable(
  'courses',
  {
    id: id(),
    legacyId: legacyId(),
    title: text().notNull(),
    slug: text().notNull().unique(),
    topic: text(),
    languages: text().array().notNull().default([]),
    categories: text().array().notNull().default([]),
    tags: text().array().notNull().default([]),
    price: text({ enum: ['paid', 'free'] })
      .notNull()
      .default('paid'),
    type: text({ enum: ['self', 'combo', 'starter'] })
      .notNull()
      .default('self'),
    rating: doublePrecision().notNull().default(0),
    hours: doublePrecision().notNull().default(0),
    amount: money().notNull().default(0),
    strikeAmount: money(),
    popularity: integer().notNull().default(0),
    newestRank: integer().notNull().default(0),
    enrolledCount: integer().notNull().default(0),
    enrolledLabel: text(),
    image: text(),
    imageAlt: text(),
    thumbClass: text().default('media-seo'),
    mediaLabel: text(),
    kind: text(),
    summary: text(),
    overview: text().array().notNull().default([]),
    journey: jsonb().notNull().default([]),
    tools: text().array().notNull().default([]),
    careers: text().array().notNull().default([]),
    whoShouldEnroll: jsonb(),
    faqs: jsonb().notNull().default([]),
    durationLabel: text(),
    status: text({ enum: ['Published', 'Draft'] })
      .notNull()
      .default('Published'),
    visibility: text({ enum: ['Public', 'Hidden'] })
      .notNull()
      .default('Public'),
    dripEnabled: boolean().notNull().default(false),
    dripSchedule: jsonb().notNull().default([]),
    automationRules: jsonb().notNull().default([]),
    drmEnabled: boolean().notNull().default(false),
    ...timestamps,
  },
  (t) => [
    index().on(t.topic),
    index().on(t.price),
    index().on(t.type),
    index().on(t.status),
    index().using('gin', t.categories),
    index().using('gin', t.tags),
  ],
)

export const courseSections = pgTable(
  'course_sections',
  {
    id: id(),
    legacyId: legacyId(),
    courseId: uuid()
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    order: integer().notNull().default(0),
    duration: text(),
    difficulty: text(),
    keyTopics: text().array().notNull().default([]),
    industryRelevance: text().array().notNull().default([]),
  },
  (t) => [index().on(t.courseId, t.order)],
)

export const lessons = pgTable(
  'lessons',
  {
    id: id(),
    legacyId: legacyId(),
    sectionId: uuid()
      .notNull()
      .references(() => courseSections.id, { onDelete: 'cascade' }),
    // Denormalised so "every lesson of course X" is one index scan, not a join.
    courseId: uuid()
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    duration: text(),
    videoUrl: text(),
    bunnyVideoId: text(),
    videoStatus: text({ enum: ['uploading', 'processing', 'ready', 'failed'] }),
    videoDurationSeconds: integer(),
    contentType: text({ enum: LESSON_CONTENT_TYPES }).notNull().default('Video'),
    isFreePreview: boolean().notNull().default(false),
    isDraft: boolean().notNull().default(false),
    isCompulsory: boolean().notNull().default(false),
    enableDiscussion: boolean().notNull().default(true),
    order: integer().notNull().default(0),
  },
  (t) => [index().on(t.sectionId, t.order), index().on(t.courseId), index().on(t.bunnyVideoId)],
)

export const coursePricingPlans = pgTable(
  'course_pricing_plans',
  {
    id: id(),
    legacyId: legacyId(),
    courseId: uuid()
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    price: money().notNull().default(0),
    compareAtPrice: money(),
    access: text({ enum: ACCESS_PERIODS }).notNull().default('Lifetime'),
    order: integer().notNull().default(0),
  },
  (t) => [index().on(t.courseId, t.order)],
)

export const enrollments = pgTable(
  'enrollments',
  {
    id: id(),
    legacyId: legacyId(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    courseId: uuid()
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    progressPct: integer().notNull().default(0),
    // No FK: a lesson deleted from the curriculum must not erase where the
    // learner was, and the player already tolerates a stale pointer.
    currentSectionId: uuid(),
    currentLessonId: uuid(),
    lastAccessedAt: timestamp({ withTimezone: true }),
    enrolledAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    status: text({ enum: ['Active', 'Completed', 'Not started'] })
      .notNull()
      .default('Not started'),
    expiresAt: timestamp({ withTimezone: true }),
    source: text({ enum: ['paid', 'manual', 'free'] })
      .notNull()
      .default('manual'),
    ...timestamps,
  },
  (t) => [unique().on(t.userId, t.courseId), index().on(t.courseId)],
)

/** Replaces Enrollment.completedLessonIds. */
export const enrollmentCompletedLessons = pgTable(
  'enrollment_completed_lessons',
  {
    enrollmentId: uuid()
      .notNull()
      .references(() => enrollments.id, { onDelete: 'cascade' }),
    lessonId: uuid()
      .notNull()
      .references(() => lessons.id, { onDelete: 'cascade' }),
    completedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.enrollmentId, t.lessonId] })],
)

export const certificates = pgTable(
  'certificates',
  {
    id: id(),
    legacyId: legacyId(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    courseId: uuid().references(() => courses.id, { onDelete: 'set null' }),
    courseTitle: text(),
    issuedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    credentialId: text().unique(),
    status: text({ enum: ['Issued', 'In progress'] })
      .notNull()
      .default('Issued'),
    ...timestamps,
  },
  (t) => [index().on(t.userId)],
)

export const practiceItems = pgTable('practice_items', {
  id: id(),
  legacyId: legacyId(),
  title: text().notNull(),
  type: text().notNull().default('Drill'),
  difficulty: text().notNull().default('Beginner'),
  courseId: uuid().references(() => courses.id, { onDelete: 'set null' }),
  description: text(),
  questionCount: integer(),
  minutes: integer(),
  ...timestamps,
})

export const practiceAttempts = pgTable(
  'practice_attempts',
  {
    id: id(),
    practiceItemId: uuid()
      .notNull()
      .references(() => practiceItems.id, { onDelete: 'cascade' }),
    userId: uuid().references(() => users.id, { onDelete: 'cascade' }),
    status: text({ enum: ['Not started', 'In progress', 'Completed'] })
      .notNull()
      .default('Not started'),
    score: doublePrecision(),
    attemptedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index().on(t.practiceItemId), index().on(t.userId)],
)
