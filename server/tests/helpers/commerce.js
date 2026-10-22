import { and, count, eq } from 'drizzle-orm'
import { db, withMongoId } from '../../src/db/index.js'
import { coerce } from '../../src/db/coerce.js'

/**
 * Small database readers for the commerce tests — the Drizzle stand-ins for
 * `Model.countDocuments({...})` / `Model.findOne({...})` / `Model.create({...})`
 * with plain column equalities, so assertions stay one line each.
 */

const whereOf = (table, filter = {}) => {
  const clauses = Object.entries(filter).map(([k, v]) => eq(table[k], v))
  return clauses.length ? and(...clauses) : undefined
}

export async function countRows(table, filter) {
  const [{ n }] = await db.select({ n: count() }).from(table).where(whereOf(table, filter))
  return n
}

export async function findRow(table, filter) {
  const [row] = await db.select().from(table).where(whereOf(table, filter)).limit(1)
  return row ? withMongoId(row) : null
}

export async function findRows(table, filter) {
  return withMongoId(await db.select().from(table).where(whereOf(table, filter)))
}

export async function insertRow(table, values) {
  const [row] = await db.insert(table).values(coerce(table, values)).returning()
  return withMongoId(row)
}

export async function updateRows(table, filter, values) {
  return db.update(table).set(values).where(whereOf(table, filter)).returning()
}
