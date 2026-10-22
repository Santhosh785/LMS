import { sql } from 'drizzle-orm'
import {
  bigint,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { ACCESS_PERIODS, id, legacyId, timestamps } from './_common.js'
import { courses, money } from './courses.js'
import { users } from './users.js'

export const customers = pgTable(
  'customers',
  {
    id: id(),
    legacyId: legacyId(),
    name: text().notNull(),
    email: text().notNull(),
    product: text(),
    joinedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    status: text({ enum: ['Active', 'Trial'] })
      .notNull()
      .default('Active'),
    userId: uuid().references(() => users.id, { onDelete: 'set null' }),
    ...timestamps,
  },
  (t) => [index().on(t.email), index().on(t.status)],
)

/**
 * Every rupee the platform has taken or refunded.
 *
 * The buyer is flattened into columns rather than kept as a nested object:
 * reconciliation and support both search by buyer email, and a column can carry
 * an index and a NOT NULL where jsonb cannot.
 */
export const transactions = pgTable(
  'transactions',
  {
    id: id(),
    legacyId: legacyId(),
    date: timestamp({ withTimezone: true }).notNull().defaultNow(),
    customerId: uuid().references(() => customers.id, { onDelete: 'set null' }),
    customerName: text(),
    contact: text(),
    product: text(),
    quantity: integer().notNull().default(1),
    amount: money().notNull(),
    currency: text().notNull().default('INR'),
    cycle: text({ enum: ['ONETIME', 'SUBSCRIPTION'] })
      .notNull()
      .default('ONETIME'),
    status: text({ enum: ['SUCCESS', 'REFUNDED', 'FAILED', 'PENDING'] })
      .notNull()
      .default('SUCCESS'),
    refundedAmount: money().notNull().default(0),
    invoiceNo: text().unique(),
    method: text({ enum: ['MANUAL_UPI', 'RAZORPAY', 'OTHER'] })
      .notNull()
      .default('OTHER'),
    utr: text(),
    courseId: uuid().references(() => courses.id, { onDelete: 'set null' }),
    courseSlug: text(),
    planName: text(),
    planAccess: text({ enum: ACCESS_PERIODS }),
    buyerName: text(),
    buyerEmail: text(),
    buyerPhone: text(),
    razorpayOrderId: text(),
    razorpayPaymentId: text().unique(),
    razorpayRefundIds: text().array().notNull().default([]),
    reviewedAt: timestamp({ withTimezone: true }),
    reviewedBy: uuid().references(() => users.id, { onDelete: 'set null' }),
    failureReason: text(),
    ...timestamps,
  },
  (t) => [
    index().on(t.date),
    index().on(t.method),
    index().on(t.courseId),
    index().on(t.razorpayOrderId),
    index().on(t.buyerEmail),
    index().on(t.status, t.date.desc()),
    // One UTR can back one live claim. A FAILED (rejected) claim frees it, so a
    // buyer who mistyped can resubmit the real reference.
    uniqueIndex('transactions_live_utr_unique')
      .on(t.utr)
      .where(sql`${t.utr} is not null and ${t.status} in ('PENDING', 'SUCCESS')`),
  ],
)

/**
 * Named monotonic counters — today only `invoice`. A row per key rather than a
 * Postgres sequence: a sequence hands out numbers outside the transaction, so a
 * rolled-back fulfilment would leave a gap in the invoice series, which GST-style
 * bookkeeping treats as a missing invoice. An UPDATE on this row rolls back with
 * everything else.
 */
export const counters = pgTable('counters', {
  key: text().primaryKey(),
  seq: bigint({ mode: 'number' }).notNull().default(0),
})
