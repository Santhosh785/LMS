import { count, eq, inArray } from 'drizzle-orm'
import { db, inParallel, withMongoId } from '../index.js'
import { coerce, isUuid } from '../coerce.js'
import { emailContactLists, emailContacts, emailLists } from '../schema/index.js'

/**
 * Email contacts as documents. List membership is the email_contact_lists join
 * table; the admin screen was written against `listIds` populated with the list
 * documents, so that is what `contactDocs` returns, and writes accept `listIds`
 * as ids (or populated objects echoed back) and sync the join rows to match.
 */
export async function contactDocs(rows) {
  if (!rows.length) return []
  const links = await db
    .select({ contactId: emailContactLists.contactId, list: emailLists })
    .from(emailContactLists)
    .innerJoin(emailLists, eq(emailLists.id, emailContactLists.listId))
    .where(
      inArray(
        emailContactLists.contactId,
        rows.map((r) => r.id),
      ),
    )
  return rows.map((r) =>
    withMongoId({
      ...r,
      listIds: links.filter((l) => l.contactId === r.id).map((l) => l.list),
    }),
  )
}

const listIdsFrom = (value) =>
  (Array.isArray(value) ? value : [])
    .map((v) => (v && typeof v === 'object' ? v._id || v.id : v))
    .filter(isUuid)

/** Replaces a contact's list membership with exactly `listIds`. */
async function syncLists(tx, contactId, listIds) {
  await tx.delete(emailContactLists).where(eq(emailContactLists.contactId, contactId))
  if (listIds.length) {
    await tx
      .insert(emailContactLists)
      .values(listIds.map((listId) => ({ contactId, listId })))
      .onConflictDoNothing()
  }
}

export async function createContact(body) {
  const row = await db.transaction(async (tx) => {
    const [created] = await tx.insert(emailContacts).values(coerce(emailContacts, body)).returning()
    await syncLists(tx, created.id, listIdsFrom(body.listIds))
    return created
  })
  await refreshListCounts()
  return (await contactDocs([row]))[0]
}

export async function updateContact(id, body) {
  const row = await db.transaction(async (tx) => {
    const values = coerce(emailContacts, body)
    const [updated] = Object.keys(values).length
      ? await tx.update(emailContacts).set(values).where(eq(emailContacts.id, id)).returning()
      : await tx.select().from(emailContacts).where(eq(emailContacts.id, id))
    if (!updated) return null
    if (body.listIds !== undefined) await syncLists(tx, id, listIdsFrom(body.listIds))
    return updated
  })
  if (!row) return null
  await refreshListCounts()
  return (await contactDocs([row]))[0]
}

/**
 * Recomputes every list's contact count.
 *
 * One UPDATE regardless of how many lists exist — the count is a GROUP BY over
 * the join table, and only lists whose number actually changed are written.
 */
export async function refreshListCounts({ tx = db } = {}) {
  const [lists, counts] = await inParallel(tx, [
    () => tx.select({ id: emailLists.id, contactCount: emailLists.contactCount }).from(emailLists),
    () =>
      tx
        .select({ listId: emailContactLists.listId, n: count() })
        .from(emailContactLists)
        .groupBy(emailContactLists.listId),
  ])
  const byList = new Map(counts.map((c) => [c.listId, c.n]))
  const changed = lists.filter((l) => l.contactCount !== (byList.get(l.id) || 0))
  for (const list of changed) {
    await tx
      .update(emailLists)
      .set({ contactCount: byList.get(list.id) || 0 })
      .where(eq(emailLists.id, list.id))
  }
}
