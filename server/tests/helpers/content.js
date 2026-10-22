import { count, eq } from 'drizzle-orm'
import { db, withMongoId } from '../../src/db/index.js'
import { coerce } from '../../src/db/coerce.js'

/**
 * Direct row access for the content tests — the Postgres stand-ins for the
 * `Model.create` / `findOne` / `countDocuments` calls they used to make. Setup
 * and read-back only; every assertion still goes through the HTTP API where it
 * did before.
 */

/** Inserts one row from a document-shaped object and returns it with `_id`. */
export async function insertRow(table, values) {
  const [row] = await db.insert(table).values(coerce(table, values)).returning()
  return withMongoId(row)
}

/** First row where `column = value`, or null. */
export async function findRow(table, column, value) {
  const [row] = await db.select().from(table).where(eq(table[column], value)).limit(1)
  return row ? withMongoId(row) : null
}

export async function findRowById(table, id) {
  return findRow(table, 'id', String(id))
}

export async function updateRow(table, column, value, values) {
  await db.update(table).set(coerce(table, values)).where(eq(table[column], value))
}

export async function countRows(table, where) {
  const [{ n }] = await db.select({ n: count() }).from(table).where(where)
  return n
}
