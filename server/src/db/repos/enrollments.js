import { and, eq, inArray } from 'drizzle-orm'
import { db, withMongoId } from '../index.js'
import { enrollmentCompletedLessons, enrollments } from '../schema/index.js'

/**
 * Enrollments as documents. Completion lives in its own table (one row per
 * finished lesson, with a real FK to the lesson), but the player and dashboard
 * read `completedLessonIds` off the enrollment — so it is reattached here.
 */
export async function enrollmentDocs(rows, { tx = db } = {}) {
  const list = (Array.isArray(rows) ? rows : [rows]).filter(Boolean)
  if (!list.length) return Array.isArray(rows) ? [] : null

  const done = await tx
    .select()
    .from(enrollmentCompletedLessons)
    .where(
      inArray(
        enrollmentCompletedLessons.enrollmentId,
        list.map((e) => e.id),
      ),
    )
  const byEnrollment = new Map()
  for (const d of done) {
    if (!byEnrollment.has(d.enrollmentId)) byEnrollment.set(d.enrollmentId, [])
    byEnrollment.get(d.enrollmentId).push(d.lessonId)
  }
  const out = list.map((e) =>
    withMongoId({ ...e, completedLessonIds: byEnrollment.get(e.id) || [] }),
  )
  return Array.isArray(rows) ? out : out[0]
}

export async function findEnrollment(userId, courseId, { tx = db } = {}) {
  const [row] = await tx
    .select()
    .from(enrollments)
    .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId)))
  return row ? enrollmentDocs(row, { tx }) : null
}
