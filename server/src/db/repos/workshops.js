import { withMongoId } from '../index.js'

/**
 * Workshop registrations as documents. The guest is three columns in the table
 * (so the partial unique index can hold one registration per guest email) but
 * one `guest` object in every response, as it was in Mongo.
 */
export function registrationDoc(row) {
  if (!row) return null
  const { guestName, guestEmail, guestPhone, ...rest } = row
  return withMongoId({
    ...rest,
    guest: {
      name: guestName ?? undefined,
      email: guestEmail ?? undefined,
      phone: guestPhone ?? undefined,
    },
  })
}

/** Document-shaped `guest` → the flat columns. */
export function guestValues(guest) {
  if (!guest || typeof guest !== 'object') return {}
  const out = {}
  if (guest.name !== undefined) out.guestName = guest.name || null
  if (guest.email !== undefined) {
    out.guestEmail = guest.email ? String(guest.email).trim().toLowerCase() : null
  }
  if (guest.phone !== undefined) out.guestPhone = guest.phone || null
  return out
}
