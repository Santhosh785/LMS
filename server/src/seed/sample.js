import { Course } from '../models/index.js'
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

  const drafts = await Course.find({
    $or: [{ status: { $ne: 'Published' } }, { visibility: { $ne: 'Public' } }],
  })
    .select('slug title')
    .lean()

  if (drafts.length === 0) {
    log('sample: every course is already published — nothing to do')
    return { published: 0 }
  }

  const res = await Course.updateMany(
    { _id: { $in: drafts.map((c) => c._id) } },
    { $set: { status: 'Published', visibility: 'Public' } },
  )

  log(`sample: published ${res.modifiedCount} course(s) for preview`)
  for (const c of drafts.slice(0, 5)) log(`  • ${c.slug}`)
  if (drafts.length > 5) log(`  • …and ${drafts.length - 5} more`)
  log('sample: these courses have no video attached — preview only, not sellable')

  return { published: res.modifiedCount }
}
