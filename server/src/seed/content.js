/**
 * The catalogue: courses, programs, workshops, blog posts, community channels,
 * practice items, gamification rules and the settings singleton.
 *
 * This is the real content of the site, so it is the half of the seeder that is
 * allowed to run against production. Two rules follow from that:
 *
 *   1. It is idempotent. Every collection is upserted on its natural key
 *      (`slug`, or `title`/`name`/`activity`/`key` where there is no slug),
 *      never wiped and reinserted, so running it twice publishes updates
 *      instead of duplicating the catalogue.
 *   2. It never reads or writes a user-generated or transactional collection.
 *      No User, Enrollment, Transaction, Customer, Certificate, Post, Booking
 *      or LeaderboardEntry document is touched here — not even to count.
 *
 * Embedded section/lesson _ids are preserved across runs (see preserveIds):
 * enrollments store completedLessonIds pointing at them, so regenerating those
 * ids on every publish would silently reset everybody's progress.
 */
import * as M from '../models/index.js'
import { log } from './guard.js'

import { courses, fillerSections } from './data/courses.js'
import { programs } from './data/program.js'
import { workshops } from './data/workshops.js'
import { blogPosts } from './data/blog.js'
import { channels } from './data/community.js'
import { practiceItems } from './data/admin.js'
import { pointRules, badges } from './data/gamification.js'
import { seedTaxonomy } from './taxonomy.js'

/**
 * Upsert a list of plain seed objects by natural key.
 * `build(doc, existing)` may reshape the payload using the current document —
 * used to carry stable ids and user-owned subdocuments forward.
 */
async function upsertAll(Model, key, docs, build) {
  let created = 0
  let updated = 0
  for (const doc of docs) {
    const existing = await Model.findOne({ [key]: doc[key] })
    const payload = build ? build(doc, existing) : doc
    if (existing) {
      existing.set(payload)
      await existing.save()
      updated += 1
    } else {
      await Model.create(payload)
      created += 1
    }
  }
  return { created, updated }
}

const tally = (label, { created, updated }) =>
  log(`${label}: ${created} created, ${updated} updated`)

/**
 * Match incoming sections/lessons to the stored ones by name and carry forward
 * what the seed data does not own.
 *
 * Two things survive a republish:
 *
 *   `_id` — enrollments store `completedLessonIds` and `currentLessonId`
 *   pointing at these, so regenerating them on every publish would silently
 *   reset everybody's progress.
 *
 *   `bunnyVideoId` / `videoUrl` — attached by hand in the admin curriculum
 *   editor and absent from the seed data. Without this, publishing content would
 *   strip the video off every lesson, and task 13's deliverability rule would
 *   then quietly unpublish the entire catalogue on the next `npm run seed`.
 *
 * Renamed or new entries get fresh ids and no video, which is correct — a
 * renamed lesson is a different lesson.
 */
function preserveIds(incoming, existing) {
  if (!existing?.length) return incoming
  const sectionByName = new Map(existing.map((s) => [s.name, s]))
  return incoming.map((section) => {
    const prev = sectionByName.get(section.name)
    if (!prev) return section
    const lessonByName = new Map((prev.lessons || []).map((l) => [l.name, l]))
    return {
      ...section,
      _id: prev._id,
      lessons: (section.lessons || []).map((lesson) => {
        const prevLesson = lessonByName.get(lesson.name)
        if (!prevLesson) return lesson
        return {
          ...lesson,
          _id: prevLesson._id,
          // Seed data wins only if it actually carries a value.
          bunnyVideoId: lesson.bunnyVideoId || prevLesson.bunnyVideoId,
          videoUrl: lesson.videoUrl || prevLesson.videoUrl,
        }
      }),
    }
  })
}

export async function seedContent() {
  /* ------------------------------- courses ------------------------------- */
  const courseStats = await upsertAll(M.Course, 'slug', courses, (c, existing) => {
    // every course needs a curriculum so the player and admin editor work
    const sections = c.sections?.length ? c.sections : fillerSections(c.title)

    /**
     * `rating`, `enrolledCount` and `enrolledLabel` are stripped from the
     * payload, and `status` is carried forward from the stored document.
     *
     * Those first three came out of the static site's markup and are claims
     * about the business made to prospective buyers — the seeder must not
     * reassert them, or task 13's `prepare` would be undone by the next content
     * publish. `status` belongs to whoever decided the course was deliverable:
     * republishing content must not put an unwatchable course back in the
     * catalogue.
     */
    const {
      rating: _rating,
      enrolledCount: _enrolledCount,
      enrolledLabel: _enrolledLabel,
      status: _status,
      image: seedImage,
      imageAlt: seedImageAlt,
      ...content
    } = c

    return {
      ...content,
      /*
       * The seeded images are stock placeholders. Once an operator has put
       * their own artwork on a course, republishing content must not drop it
       * back to a stock photo — so the seed value only fills an empty field.
       */
      image: existing?.image || seedImage,
      imageAlt: existing?.image ? existing.imageAlt : seedImageAlt,
      ...(existing
        ? { status: existing.status }
        : // A brand-new course starts as a Draft regardless of what the seed data
          // says: nothing has video attached yet, so nothing is deliverable.
          { status: 'Draft', rating: 0, enrolledCount: 0, enrolledLabel: '' }),
      sections: preserveIds(sections, existing?.sections),
      pricingPlans: c.pricingPlans?.length
        ? c.pricingPlans
        : [
            {
              name: 'Lifetime access',
              price: c.amount,
              compareAtPrice: c.strikeAmount,
              access: 'Lifetime',
            },
          ],
    }
  })
  tally('courses', courseStats)

  /* --------------------------- other catalogue --------------------------- */
  tally('programs', await upsertAll(M.Program, 'slug', programs))
  tally('workshops', await upsertAll(M.Workshop, 'slug', workshops))
  tally('blog posts', await upsertAll(M.BlogPost, 'slug', blogPosts))

  // memberIds is membership, not content: it is deliberately absent from the
  // payload so an existing channel keeps whoever has joined it.
  tally('channels', await upsertAll(M.Channel, 'slug', channels))

  /* ----------------------------- practice -------------------------------- */
  const seoCourse = await M.Course.findOne({ slug: 'seo-mastery' }).select('_id')
  // `attempts` holds per-student progress, so it is never part of the payload.
  tally(
    'practice items',
    await upsertAll(M.PracticeItem, 'title', practiceItems, (p) => ({
      ...p,
      courseId: seoCourse?._id,
    })),
  )

  /* --------------------------- gamification ------------------------------ */
  tally('point rules', await upsertAll(M.PointRule, 'activity', pointRules))
  tally('badges', await upsertAll(M.Badge, 'name', badges))

  /* ------------------------------ taxonomy ------------------------------- */
  // Runs after the catalogue so it can observe the topics, languages and
  // categories the content actually uses. Adds terms, never removes or
  // rewrites one an operator has since edited.
  await seedTaxonomy()

  /* ------------------------------ settings ------------------------------- */
  // Created on first run only — the admin settings screen owns it afterwards.
  await M.Setting.getSingleton()
  log('settings: singleton present')

  log(
    'content seed complete ✔ (no user, enrollment, payment or certificate data was read or written)',
  )
}
