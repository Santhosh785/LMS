import { jsonb, pgTable, text } from 'drizzle-orm/pg-core'
import { id, legacyId, timestamps } from './_common.js'

/**
 * The site singleton (`key = 'site'`). Each settings group is one jsonb column,
 * mirroring the old nested document so the admin forms and runtimeConfig read
 * the same shape. The `*Enc` fields inside payments/mail/video/media hold
 * secretBox ciphertext, never plaintext — and since the browser never reaches
 * this database, RLS lockdown plus server-side stripping keep them server-only.
 */
export const settings = pgTable('settings', {
  id: id(),
  legacyId: legacyId(),
  key: text().notNull().unique().default('site'),
  branding: jsonb().notNull().default({}),
  menu: jsonb().notNull().default({}),
  help: jsonb().notNull().default({}),
  domain: jsonb().notNull().default({}),
  gamification: jsonb().notNull().default({}),
  features: jsonb().notNull().default({}),
  payments: jsonb().notNull().default({}),
  mail: jsonb().notNull().default({}),
  video: jsonb().notNull().default({}),
  media: jsonb().notNull().default({}),
  business: jsonb().notNull().default({}),
  ...timestamps,
})

/**
 * Defaults the Mongoose schema applied on read. jsonb columns have no per-key
 * defaults, so readers merge these under whatever is stored.
 */
export const SETTING_DEFAULTS = {
  branding: {
    brandName: 'Growth Scholar',
    productName: 'Growth Scholar Learn',
    accentColor: '#3ecf8e',
  },
  menu: {
    showWorkshops: true,
    showCourses: true,
    showCommunity: true,
    showBlog: true,
    showPractice: true,
  },
  help: {
    supportEmail: 'support@growthscholar.in',
    salesEmail: 'hello@growthscholar.in',
    hours: 'Mon–Sat, 10am–7pm IST',
  },
  domain: { host: 'growthscholar.in', verified: true },
  gamification: {
    pointsName: 'Seeds',
    pointsIcon: '🌱',
    leaderboardEnabled: true,
    showOnProfile: true,
  },
  features: { funnels: null, email: null, gamification: null },
  payments: {},
  mail: {},
  video: {},
  media: {},
  business: {},
}
