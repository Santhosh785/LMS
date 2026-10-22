import { sql } from 'drizzle-orm'
import { text, timestamp, uuid } from 'drizzle-orm/pg-core'

/**
 * Columns every table carries.
 *
 * `legacyId` holds the Mongo ObjectId a row was migrated from. The ETL remaps
 * references through it, and the legacy-redirect middleware uses it to send old
 * /courses/<objectId> links to the new uuid. Rows created after cutover leave it
 * null; the unique index ignores nulls.
 */
export const id = () =>
  uuid()
    .primaryKey()
    .default(sql`gen_random_uuid()`)

export const legacyId = () => text().unique()

export const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}

/** Shared by Course pricing plans and the Transaction that bought one. */
export const ACCESS_PERIODS = ['Lifetime', '12 months', '6 months']
