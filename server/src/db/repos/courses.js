import { and, asc, eq, inArray, notInArray } from 'drizzle-orm'
import { db, inParallel, withMongoId } from '../index.js'
import { coerce, isUuid } from '../coerce.js'
import { courses, courseSections, coursePricingPlans, lessons } from '../schema/index.js'

/**
 * Courses as documents.
 *
 * Everything above this file — the admin curriculum editor, the player, the
 * Bunny webhook, checkout — was written against one nested Course document:
 * `sections[].lessons[]` and `pricingPlans[]`. The tables are normalised, so
 * this module is where the two meet: it loads a course back into that shape and
 * writes the shape back out to the child tables.
 *
 * The one rule the writer keeps: **an existing section, lesson or plan keeps its
 * id across an edit.** Enrollment progress, the player's resume pointer and the
 * Bunny webhook all point at lesson ids; a save that deleted and re-inserted the
 * curriculum would silently reset every learner's progress.
 */

const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0)

/** Attaches sections → lessons and pricing plans to course rows. */
export async function hydrateCourses(rows, { tx = db, curriculum = true } = {}) {
  const list = Array.isArray(rows) ? rows : [rows]
  const ids = list.filter(Boolean).map((c) => c.id)
  if (!ids.length) return Array.isArray(rows) ? [] : null

  const [sectionRows, lessonRows, planRows] = await inParallel(tx, [
    () => tx.select().from(courseSections).where(inArray(courseSections.courseId, ids)),
    () =>
      curriculum
        ? tx.select().from(lessons).where(inArray(lessons.courseId, ids))
        : Promise.resolve([]),
    () =>
      tx
        .select()
        .from(coursePricingPlans)
        .where(inArray(coursePricingPlans.courseId, ids))
        .orderBy(asc(coursePricingPlans.order)),
  ])

  const lessonsBySection = new Map()
  for (const l of lessonRows) {
    if (!lessonsBySection.has(l.sectionId)) lessonsBySection.set(l.sectionId, [])
    lessonsBySection.get(l.sectionId).push(l)
  }

  const out = list.map((course) => {
    if (!course) return course
    const sections = sectionRows
      .filter((s) => s.courseId === course.id)
      .sort(byOrder)
      .map((s) => ({ ...s, lessons: (lessonsBySection.get(s.id) || []).sort(byOrder) }))
    const pricingPlans = planRows.filter((p) => p.courseId === course.id)
    return withMongoId({ ...course, sections, pricingPlans, moduleCount: sections.length })
  })
  return Array.isArray(rows) ? out : out[0]
}

export async function findCourse(where, opts = {}) {
  const tx = opts.tx || db
  const [row] = await tx.select().from(courses).where(where).limit(1)
  return row ? hydrateCourses(row, opts) : null
}

export const findCourseById = (id, opts) =>
  isUuid(id) ? findCourse(eq(courses.id, id), opts) : Promise.resolve(null)

export const findCourseBySlug = (slug, opts) =>
  findCourse(eq(courses.slug, String(slug).toLowerCase()), opts)

/**
 * Replaces a course's curriculum with `sections`, preserving ids.
 *
 * A section or lesson that arrives with an `_id` already belonging to this
 * course is updated in place; one without (or with a foreign id) is inserted;
 * anything stored but absent from the payload is deleted. Array position is the
 * order — the editor sends sections in the order it displays them.
 */
export async function saveCurriculum(tx, courseId, sections = []) {
  const existingSections = await tx
    .select({ id: courseSections.id })
    .from(courseSections)
    .where(eq(courseSections.courseId, courseId))
  const ownSections = new Set(existingSections.map((s) => s.id))

  const existingLessons = await tx
    .select({ id: lessons.id })
    .from(lessons)
    .where(eq(lessons.courseId, courseId))
  const ownLessons = new Set(existingLessons.map((l) => l.id))

  const keptSections = []
  const keptLessons = []

  for (const [si, section] of sections.entries()) {
    const sid = section._id || section.id
    const values = { ...coerce(courseSections, section), courseId, order: si }
    let sectionId
    if (ownSections.has(sid)) {
      await tx.update(courseSections).set(values).where(eq(courseSections.id, sid))
      sectionId = sid
    } else {
      const [row] = await tx
        .insert(courseSections)
        .values({ name: 'Untitled section', ...values })
        .returning({ id: courseSections.id })
      sectionId = row.id
    }
    keptSections.push(sectionId)

    for (const [li, lesson] of (section.lessons || []).entries()) {
      const lid = lesson._id || lesson.id
      const lv = { ...coerce(lessons, lesson), sectionId, courseId, order: li }
      if (ownLessons.has(lid)) {
        await tx.update(lessons).set(lv).where(eq(lessons.id, lid))
        keptLessons.push(lid)
      } else {
        const [row] = await tx
          .insert(lessons)
          .values({ name: 'Untitled lesson', ...lv })
          .returning({ id: lessons.id })
        keptLessons.push(row.id)
      }
    }
  }

  // Lessons first: a lesson moved between sections must not be cascaded away
  // with the section it left.
  await tx
    .delete(lessons)
    .where(
      keptLessons.length
        ? and(eq(lessons.courseId, courseId), notInArray(lessons.id, keptLessons))
        : eq(lessons.courseId, courseId),
    )
  await tx
    .delete(courseSections)
    .where(
      keptSections.length
        ? and(eq(courseSections.courseId, courseId), notInArray(courseSections.id, keptSections))
        : eq(courseSections.courseId, courseId),
    )
}

/** Same id-preserving replace for pricing plans — checkout addresses plans by id. */
export async function savePricingPlans(tx, courseId, plans = []) {
  const existing = await tx
    .select({ id: coursePricingPlans.id })
    .from(coursePricingPlans)
    .where(eq(coursePricingPlans.courseId, courseId))
  const own = new Set(existing.map((p) => p.id))
  const kept = []

  for (const [i, plan] of plans.entries()) {
    const pid = plan._id || plan.id
    const values = { ...coerce(coursePricingPlans, plan), courseId, order: i }
    if (own.has(pid)) {
      await tx.update(coursePricingPlans).set(values).where(eq(coursePricingPlans.id, pid))
      kept.push(pid)
    } else {
      const [row] = await tx
        .insert(coursePricingPlans)
        .values({ name: 'Plan', ...values })
        .returning({ id: coursePricingPlans.id })
      kept.push(row.id)
    }
  }

  await tx
    .delete(coursePricingPlans)
    .where(
      kept.length
        ? and(eq(coursePricingPlans.courseId, courseId), notInArray(coursePricingPlans.id, kept))
        : eq(coursePricingPlans.courseId, courseId),
    )
}

/** Creates a course from a document-shaped body, children included. */
export async function createCourse(body, { tx: outer } = {}) {
  const run = async (tx) => {
    const [row] = await tx.insert(courses).values(coerce(courses, body)).returning()
    if (Array.isArray(body.sections)) await saveCurriculum(tx, row.id, body.sections)
    if (Array.isArray(body.pricingPlans)) await savePricingPlans(tx, row.id, body.pricingPlans)
    return findCourseById(row.id, { tx })
  }
  return outer ? run(outer) : db.transaction(run)
}

/**
 * Applies a document-shaped patch. `sections` and `pricingPlans` replace the
 * child rows; every other key is a column. Returns the hydrated course, or null
 * when no course has that id.
 */
export async function updateCourse(id, patch, { tx: outer, allow } = {}) {
  if (!isUuid(id)) return null
  const run = async (tx) => {
    const values = coerce(courses, patch, { allow })
    const [row] = Object.keys(values).length
      ? await tx.update(courses).set(values).where(eq(courses.id, id)).returning()
      : await tx.select().from(courses).where(eq(courses.id, id))
    if (!row) return null
    const may = (k) => !allow || allow.includes(k)
    if (may('sections') && Array.isArray(patch.sections)) {
      await saveCurriculum(tx, id, patch.sections)
    }
    if (may('pricingPlans') && Array.isArray(patch.pricingPlans)) {
      await savePricingPlans(tx, id, patch.pricingPlans)
    }
    return findCourseById(id, { tx })
  }
  return outer ? run(outer) : db.transaction(run)
}

/** Writes lesson columns directly — the video upload and webhook paths. */
export async function updateLesson(lessonId, patch, { tx = db } = {}) {
  if (!isUuid(lessonId)) return null
  const [row] = await tx
    .update(lessons)
    .set(coerce(lessons, patch))
    .where(eq(lessons.id, lessonId))
    .returning()
  return row ? withMongoId(row) : null
}
