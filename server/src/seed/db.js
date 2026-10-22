import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { coerce } from '../db/coerce.js'

/**
 * Upsert a list of plain seed objects by natural key — the Postgres version of
 * the Mongoose `findOne` + `set` + `save` loop the seeders were written around.
 *
 * `build(doc, existing)` may reshape the payload using the stored row, which is
 * how stable ids and operator-owned fields are carried forward.
 */
export async function upsertAll(table, key, docs, build) {
  let created = 0
  let updated = 0
  for (const doc of docs) {
    const [existing] = await db.select().from(table).where(eq(table[key], doc[key]))
    const values = coerce(table, build ? build(doc, existing) : doc)
    if (existing) {
      await db.update(table).set(values).where(eq(table.id, existing.id))
      updated += 1
    } else {
      await db.insert(table).values(values)
      created += 1
    }
  }
  return { created, updated }
}

/** Inserts many seed objects, column-cast, returning the stored rows. */
export async function insertAll(table, docs, extra = () => ({})) {
  if (!docs.length) return []
  return db
    .insert(table)
    .values(docs.map((d) => ({ ...coerce(table, d), ...extra(d) })))
    .returning()
}
