import { inArray, ne, or } from 'drizzle-orm'
import { db } from '../db/index.js'
import { courses } from '../db/schema/index.js'
import { isProduction, log } from './guard.js'

/**
 * Publishes the seeded catalogue so the public site renders fully.
 *
 * The content seed deliberately creates every new course as a **Draft**,
 * because nothing has video attached and a catalogue whose courses cannot be
 * watched after payment is worse than a smaller one. That is right for a real
 * deployment and unhelpful when the whole point is to look at the design: a
 * fresh database renders a site with an empty catalogue, no career banner and
 * no homepage rails.
 *
 * This is the preview switch. It publishes what the seed created so the public
 * pages have something to show, and refuses to run against production, where
 * the same action would put unwatchable courses in front of real buyers.
 */
export async function seedSample() {
  if (isProduction()) {
    throw new Error(
      'sample refuses to run with NODE_ENV=production — it publishes courses whose lessons have no video, which a real buyer could pay for. Use `seed:prepare` instead.',
    )
  }

  const drafts = await db
    .select({ id: courses.id, slug: courses.slug, title: courses.title })
    .from(courses)
    .where(or(ne(courses.status, 'Published'), ne(courses.visibility, 'Public')))

  if (drafts.length === 0) {
    log('sample: every course is already published — nothing to do')
    return { published: 0 }
  }

  const published = await db
    .update(courses)
    .set({ status: 'Published', visibility: 'Public' })
    .where(
      inArray(
        courses.id,
        drafts.map((c) => c.id),
      ),
    )
    .returning({ id: courses.id })

  log(`sample: published ${published.length} course(s) for preview`)
  for (const c of drafts.slice(0, 5)) log(`  • ${c.slug}`)
  if (drafts.length > 5) log(`  • …and ${drafts.length - 5} more`)
  log('sample: these courses have no video attached — preview only, not sellable')

  return { published: published.length }
}
