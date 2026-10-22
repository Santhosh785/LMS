import {
  doublePrecision,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  index,
} from 'drizzle-orm/pg-core'
import { legacyId, timestamps } from './_common.js'

/**
 * Profile rows for Supabase Auth identities.
 *
 * `id` is the auth.users id — the foreign key to auth.users (on delete cascade)
 * is added by a hand-written migration, because the auth schema is Supabase's and
 * not ours to model. Credentials live entirely in auth.users; nothing here can
 * sign anyone in. `role` lives here and only here: user_metadata is writable by
 * the user through the Auth API, so trusting a role from it is a privilege
 * escalation.
 */
export const users = pgTable(
  'users',
  {
    id: uuid().primaryKey(),
    legacyId: legacyId(),
    name: text().notNull(),
    email: text().notNull().unique(),
    role: text({ enum: ['student', 'admin'] })
      .notNull()
      .default('student'),
    suspendedAt: timestamp({ withTimezone: true }),
    suspendedReason: text(),
    avatarInitials: text(),
    phone: text(),
    education: text(),
    currentProfile: text(),
    preferredLanguage: text(),
    streakDays: integer().notNull().default(0),
    hoursThisWeek: doublePrecision().notNull().default(0),
    seeds: integer().notNull().default(0),
    weeklyGoalHours: integer().notNull().default(8),
    passwordChangedAt: timestamp({ withTimezone: true }),
    // Our own reset/invite tokens (SHA-256 only), not Supabase's. Supabase's
    // recovery links are consumed on first verify — which the reset page's
    // "is this link still good?" check would do — and share one expiry setting,
    // where we need 1h for resets and 24h for invites. Never sent to a client.
    passwordResetTokenHash: text(),
    passwordResetExpiresAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [index().on(t.role), index().on(t.suspendedAt), index().on(t.passwordResetTokenHash)],
)

/** Mirrors the old pre-validate hook: "Asha Rao" → "AR". */
export const initialsFor = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
