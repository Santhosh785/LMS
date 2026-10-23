/**
 * Curriculum arithmetic shared by the course player, the public course page and
 * the "Course content" list. Plain functions, kept out of the component file so
 * React fast refresh can hot-swap the components.
 */

/** "12:34" / "1:02:03" → seconds. Anything else (or nothing) counts as 0. */
export function toSeconds(duration) {
  const parts = String(duration || '')
    .trim()
    .split(':')
    .map(Number)
  if (parts.length < 2 || parts.some((n) => !Number.isFinite(n))) return 0
  return parts.reduce((total, n) => total * 60 + n, 0)
}

/** 2280 → "38min", 4500 → "1hr 15min" — the curriculum's compact style. */
export function formatTotal(seconds) {
  if (!seconds) return ''
  const mins = Math.round(seconds / 60)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (!h) return `${m}min`
  return m ? `${h}hr ${m}min` : `${h}hr`
}

/** Lesson durations are "mm:ss"; the list shows whole minutes. */
export const lessonLength = (duration) => {
  const s = toSeconds(duration)
  return s ? `${Math.max(1, Math.round(s / 60))}min` : duration || ''
}

export const courseSeconds = (course) =>
  (course?.sections || []).reduce(
    (t, s) => t + (s.lessons || []).reduce((u, l) => u + toSeconds(l.duration), 0),
    0,
  )

export const lessonCount = (course) =>
  (course?.sections || []).reduce((t, s) => t + (s.lessons || []).length, 0)

/** A free preview the visitor can actually play right now. */
export const isPlayablePreview = (l) =>
  Boolean(l.isFreePreview && l.hasVideo && l.videoStatus === 'ready')
