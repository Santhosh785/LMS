import { eq, sql } from 'drizzle-orm'
import { db, withMongoId } from '../index.js'
import { coerce, isUuid } from '../coerce.js'
import { counters, transactions } from '../schema/index.js'

/**
 * Transactions as documents. The buyer is three columns in the table (so it can
 * be indexed and searched) but one `buyer` object everywhere above this file —
 * the checkout routes, fulfilment, the admin payments screen and the CSV export
 * all read `txn.buyer.email`.
 */
export function txnDoc(row) {
  if (!row) return null
  const { buyerName, buyerEmail, buyerPhone, ...rest } = row
  return withMongoId({
    ...rest,
    buyer: {
      name: buyerName ?? undefined,
      email: buyerEmail ?? undefined,
      phone: buyerPhone ?? undefined,
    },
  })
}

/** Document-shaped input → column values. Accepts `buyer: {}` or flat keys. */
export function txnValues(body = {}) {
  const { buyer, ...rest } = body
  const values = coerce(transactions, rest)
  if (buyer && typeof buyer === 'object') {
    if (buyer.name !== undefined) values.buyerName = buyer.name || null
    if (buyer.email !== undefined)
      values.buyerEmail = buyer.email ? String(buyer.email).trim().toLowerCase() : null
    if (buyer.phone !== undefined) values.buyerPhone = buyer.phone || null
  }
  return values
}

export async function findTransactionById(id, { tx = db } = {}) {
  if (!isUuid(id)) return null
  const [row] = await tx.select().from(transactions).where(eq(transactions.id, id))
  return txnDoc(row)
}

export async function insertTransaction(body, { tx = db } = {}) {
  const [row] = await tx.insert(transactions).values(txnValues(body)).returning()
  return txnDoc(row)
}

/**
 * Next value of a named counter. Must be called inside the transaction that
 * uses the number: the increment is a row update, so it commits or rolls back
 * with the sale — a fulfilment that fails halfway leaves no hole in the invoice
 * series. The row lock it takes also serialises concurrent fulfilments on the
 * counter, which is exactly the ordering a sequential series needs.
 */
export async function nextCounter(tx, key) {
  const [row] = await tx
    .insert(counters)
    .values({ key, seq: 1 })
    .onConflictDoUpdate({ target: counters.key, set: { seq: sql`${counters.seq} + 1` } })
    .returning({ seq: counters.seq })
  return row.seq
}
