import { asc, eq, sql } from 'drizzle-orm'
import { db, withMongoId } from '../index.js'
import { workshops } from '../schema/index.js'

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

/**
 * A workshop by slug, as stored, or null. Workshops have no status or
 * visibility column, so every row is public — the same rule GET
 * /api/workshops/:slug applies.
 */
export async function findWorkshopBySlug(slug) {
  const [workshop] = await db
    .select()
    .from(workshops)
    .where(eq(workshops.slug, String(slug).toLowerCase()))
  return workshop || null
}

/**
 * The first `limit` workshops in the order GET /api/workshops lists them
 * (language, then start date, missing values first, as Mongo sorted them),
 * with only the columns a workshop card renders. The home page previews the
 * first three; it reads them here rather than over HTTP and without the rest
 * of the row (landing copy, capacity, host).
 */
export function listWorkshopCards(limit) {
  return db
    .select({
      slug: workshops.slug,
      title: workshops.title,
      language: workshops.language,
      mode: workshops.mode,
      venue: workshops.venue,
      durationLabel: workshops.durationLabel,
      image: workshops.image,
      bannerClass: workshops.bannerClass,
      priceNew: workshops.priceNew,
    })
    .from(workshops)
    .orderBy(
      sql`${workshops.language} asc nulls first`,
      sql`${workshops.startsAt} asc nulls first`,
      asc(workshops.id),
    )
    .limit(limit)
}

/**
 * `{ slug, updatedAt }` for every workshop — the sitemap's input. Workshops have
 * no visibility column, so every row is public.
 */
export function listWorkshopSlugs() {
  return db
    .select({ slug: workshops.slug, updatedAt: workshops.updatedAt })
    .from(workshops)
    .orderBy(asc(workshops.slug))
}
