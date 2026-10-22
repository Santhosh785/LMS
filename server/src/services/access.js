import { Course, Enrollment } from '../models/index.js'

/**
 * Course access, in one place.
 *
 * Every path that hands someone a course — self-enrolment in a free course, the
 * admin "add to course" action, manual UPI approval (task 12) and the Razorpay
 * webhook (task 16) — goes through `grantAccess` below. Duplicating the upsert
 * per caller is how one of them ends up forgetting the enrolment counter or the
 * expiry, and access bugs are silent: nobody reports being given too much.
 */

/** How the access was obtained. Answers a support question months later. */
export const ACCESS_SOURCES = ['paid', 'manual', 'free']

/**
 * `Course.pricingPlans[].access` sells three tiers. Lifetime is represented as a
 * null expiry rather than a far-future date so "no expiry" is not a magic
 * constant somebody later compares against.
 */
const TIER_MONTHS = { '12 months': 12, '6 months': 6 }

export function expiryForAccessTier(access, from = new Date()) {
  const months = TIER_MONTHS[access]
  if (!months) return null // 'Lifetime', undefined, or an unknown tier
  const expires = new Date(from)
  expires.setMonth(expires.getMonth() + months)
  return expires
}

/** An enrolment with a null `expiresAt` is lifetime and never expires. */
export const isExpired = (enrollment, now = new Date()) =>
  Boolean(enrollment?.expiresAt) && new Date(enrollment.expiresAt).getTime() <= now.getTime()

/**
 * Lifetime beats any dated access, and a longer window beats a shorter one — so
 * re-granting can only ever extend what someone already has, never cut it short.
 */
const laterExpiry = (a, b) => {
  if (a === null || b === null) return null
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b
}

/**
 * Idempotent. Calling twice for the same pair produces one enrolment and moves
 * `enrolledCount` once — the operator in task 12 will double-click, and Razorpay
 * redelivers webhooks as a matter of course.
 *
 * Returns `{ enrollment, created }` so callers can decide whether to send a
 * welcome email without re-querying.
 */
export async function grantAccess(userId, courseId, { expiresAt = null, source = 'manual' } = {}) {
  if (!ACCESS_SOURCES.includes(source)) {
    throw new Error(`grantAccess: unknown source "${source}"`)
  }

  const now = new Date()

  // The upsert is the concurrency guard: two simultaneous grants race on the
  // unique { userId, courseId } index and exactly one of them reports an insert.
  const result = await Enrollment.updateOne(
    { userId, courseId },
    {
      $setOnInsert: {
        userId,
        courseId,
        status: 'Not started',
        enrolledAt: now,
        lastAccessedAt: now,
        expiresAt,
        source,
      },
    },
    { upsert: true },
  )

  const created = result.upsertedCount > 0

  if (created) {
    // Only the caller that actually inserted touches the counter.
    await Course.updateOne({ _id: courseId }, { $inc: { enrolledCount: 1 } })
    return { enrollment: await Enrollment.findOne({ userId, courseId }), created }
  }

  // Already enrolled: extend the window if this grant is worth more, and record
  // the most recent reason access was given.
  const existing = await Enrollment.findOne({ userId, courseId })
  const merged = laterExpiry(existing.expiresAt ?? null, expiresAt)
  if ((merged ?? null) !== (existing.expiresAt ?? null) || existing.source !== source) {
    existing.expiresAt = merged
    existing.source = source
    await existing.save()
  }
  return { enrollment: existing, created: false }
}

/**
 * Revoke — used by the refund path in task 16. Removing the row rather than
 * flagging it keeps `GET /api/enrollments/course/:slug` a single lookup.
 */
export async function revokeAccess(userId, courseId) {
  const removed = await Enrollment.findOneAndDelete({ userId, courseId })
  if (removed) {
    await Course.updateOne(
      { _id: courseId, enrolledCount: { $gt: 0 } },
      { $inc: { enrolledCount: -1 } },
    )
  }
  return Boolean(removed)
}
