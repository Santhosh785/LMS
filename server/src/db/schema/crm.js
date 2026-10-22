import { boolean, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { id, legacyId, timestamps } from './_common.js'
import { users } from './users.js'

/**
 * The three inboxes (mentor-popup leads, fit-call requests, flagship
 * applications) each had an embedded `notes` array. Each gets its own notes
 * table rather than one polymorphic one, so every note carries a real foreign
 * key to the record it annotates and is deleted with it.
 */
const noteColumns = () => ({
  id: id(),
  body: text().notNull(),
  author: uuid().references(() => users.id, { onDelete: 'set null' }),
  authorName: text(),
  at: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

export const leads = pgTable(
  'leads',
  {
    id: id(),
    legacyId: legacyId(),
    name: text(),
    email: text().notNull(),
    phone: text().notNull(),
    education: text(),
    profile: text(),
    yearOfPassing: text(),
    language: text(),
    source: text().notNull().default('mentor-popup'),
    page: text(),
    status: text({ enum: ['New', 'Contacted', 'Qualified', 'Converted', 'Lost'] })
      .notNull()
      .default('New'),
    owner: uuid().references(() => users.id, { onDelete: 'set null' }),
    nextFollowUpAt: timestamp({ withTimezone: true }),
    convertedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index().on(t.source),
    index().on(t.status),
    index().on(t.owner),
    index().on(t.nextFollowUpAt),
    index().on(t.createdAt.desc()),
  ],
)

export const leadNotes = pgTable(
  'lead_notes',
  {
    ...noteColumns(),
    leadId: uuid()
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
  },
  (t) => [index().on(t.leadId, t.at)],
)

export const fitCallBookings = pgTable(
  'fit_call_bookings',
  {
    id: id(),
    legacyId: legacyId(),
    fullName: text().notNull(),
    email: text().notNull(),
    phone: text().notNull(),
    timezone: text().notNull().default('IST'),
    preferredWeek: text(),
    preferredSlots: text().array().notNull().default([]),
    callLanguage: text(),
    scheduleNotes: text(),
    currentStatus: text(),
    weeklyHours: text(),
    submittedFullApplication: text({ enum: ['yes', 'no', 'planning-to'] })
      .notNull()
      .default('no'),
    whyCallNow: text(),
    biggestBlocker: text(),
    callQuestions: text(),
    referralSource: text(),
    consent: boolean().notNull(),
    status: text({ enum: ['Requested', 'Scheduled', 'Completed', 'No-show', 'Cancelled'] })
      .notNull()
      .default('Requested'),
    scheduledAt: timestamp({ withTimezone: true }),
    owner: uuid().references(() => users.id, { onDelete: 'set null' }),
    page: text(),
    ...timestamps,
  },
  (t) => [
    index().on(t.email),
    index().on(t.status),
    index().on(t.owner),
    index().on(t.createdAt.desc()),
  ],
)

export const fitCallBookingNotes = pgTable(
  'fit_call_booking_notes',
  {
    ...noteColumns(),
    fitCallBookingId: uuid()
      .notNull()
      .references(() => fitCallBookings.id, { onDelete: 'cascade' }),
  },
  (t) => [index().on(t.fitCallBookingId, t.at)],
)

export const flagshipApplications = pgTable(
  'flagship_applications',
  {
    id: id(),
    legacyId: legacyId(),
    fullName: text().notNull(),
    email: text().notNull(),
    phone: text().notNull(),
    linkedin: text(),
    city: text().notNull(),
    state: text().notNull(),
    trackPreference: text({ enum: ['track-a', 'track-b', 'undecided'] }).notNull(),
    batchPreference: text({ enum: ['batch-4', 'batch-5-waitlist', 'flexible'] }).notNull(),
    mentoringLanguage: text().notNull(),
    currentStatus: text().notNull(),
    employer: text(),
    weeklyHours: text({ enum: ['under-8', '8-10', '10-12', '12-15'] }).notNull(),
    liveAvailability: text().array().notNull().default([]),
    hasSetup: text({ enum: ['yes', 'partial', 'no'] }).notNull(),
    masterclassCity: text().notNull(),
    scheduleBlockers: text(),
    experienceLevel: text({
      enum: [
        'exploring',
        'complete-beginner',
        'some-campaigns',
        'working-marketer',
        'founder-operator',
      ],
    }).notNull(),
    channels: text().array().notNull().default([]),
    monthlySpend: text(),
    toolsUsed: text(),
    portfolioUrl: text(),
    starterCourses: text(),
    referralSource: text().notNull(),
    referralDetail: text().notNull(),
    whyFlagship: text().notNull(),
    twelveWeekOutcome: text().notNull(),
    shipStory: text().notNull(),
    curriculumHook: text().notNull(),
    paymentPlan: text({ enum: ['full', 'scholarship'] }).notNull(),
    scholarshipCase: text(),
    consentWhatsapp: boolean().notNull(),
    consentAccurate: boolean().notNull(),
    status: text({
      enum: ['New', 'Shortlisted', 'Fit call booked', 'Accepted', 'Waitlisted', 'Rejected'],
    })
      .notNull()
      .default('New'),
    owner: uuid().references(() => users.id, { onDelete: 'set null' }),
    reviewedAt: timestamp({ withTimezone: true }),
    decidedAt: timestamp({ withTimezone: true }),
    page: text(),
    ...timestamps,
  },
  (t) => [
    index().on(t.email),
    index().on(t.status),
    index().on(t.owner),
    index().on(t.createdAt.desc()),
  ],
)

export const flagshipApplicationNotes = pgTable(
  'flagship_application_notes',
  {
    ...noteColumns(),
    flagshipApplicationId: uuid()
      .notNull()
      .references(() => flagshipApplications.id, { onDelete: 'cascade' }),
  },
  (t) => [index().on(t.flagshipApplicationId, t.at)],
)
