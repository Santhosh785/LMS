import { asc, eq } from 'drizzle-orm'
import { db, withMongoId } from '../index.js'
import { customers } from '../schema/index.js'

/**
 * The checkout's "find or create the customer for this email" — what Mongo's
 * findOneAndUpdate({ email }, { $set, $setOnInsert }, { upsert: true }) did.
 *
 * `email` is not unique on customers (the admin can enter duplicates by hand),
 * so this targets the oldest row for the address, as the Mongo upsert matched
 * the first document it found.
 */
export async function upsertCustomerByEmail(email, { name, product }, { tx = db } = {}) {
  const [existing] = await tx
    .select({ id: customers.id })
    .from(customers)
    .where(eq(customers.email, email))
    .orderBy(asc(customers.createdAt))
    .limit(1)

  if (existing) {
    const [row] = await tx
      .update(customers)
      .set({ name, product })
      .where(eq(customers.id, existing.id))
      .returning()
    return withMongoId(row)
  }
  const [row] = await tx
    .insert(customers)
    .values({ email, name, product, joinedAt: new Date(), status: 'Trial' })
    .returning()
  return withMongoId(row)
}
