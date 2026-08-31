import crypto from 'node:crypto'
import { cfg } from './runtimeConfig.js'

/**
 * Bunny Stream embed token signing.
 *
 * Gating the player page is cosmetic on its own — if the video URL itself is
 * public, one shared link bypasses the paywall for everyone. Token
 * authentication moves the check to the CDN: Bunny refuses a request whose token
 * does not match, and every URL dies on a short clock.
 *
 * Bunny's embed scheme is:
 *
 *   token   = sha256_hex(securityKey + videoId + expires)
 *   url     = https://iframe.mediadelivery.net/embed/{libraryId}/{videoId}
 *             ?token={token}&expires={expires}
 *
 * where `expires` is a Unix timestamp in seconds.
 *
 * MANUAL STEP — this is enforcement, not obfuscation, only once it is switched
 * on: Bunny dashboard → Stream → the library → **Security** → enable
 * "Token Authentication". Until that toggle is on, Bunny serves the video to
 * anyone who asks and the token is decorative.
 */

const EMBED_BASE = 'https://iframe.mediadelivery.net/embed'

/**
 * Fifteen minutes. Long enough that a student who pauses to make tea does not
 * come back to a dead frame, short enough that a captured URL pasted into a
 * group chat is worthless by the time anyone clicks it. Task 11's player
 * re-requests rather than letting one expire mid-session.
 */
export const PLAYBACK_TTL_SECONDS = 15 * 60

export const isBunnyConfigured = () => Boolean(cfg.bunnyLibraryId && cfg.bunnySecurityKey)

/**
 * @returns {{ url: string, expiresAt: Date, ttlSeconds: number }}
 */
export function signPlaybackUrl(videoId, { ttlSeconds = PLAYBACK_TTL_SECONDS } = {}) {
  if (!videoId) throw new Error('signPlaybackUrl: videoId is required')
  if (!isBunnyConfigured()) {
    throw new Error('Bunny Stream is not configured (BUNNY_LIBRARY_ID / BUNNY_SECURITY_KEY)')
  }

  const expires = Math.floor(Date.now() / 1000) + ttlSeconds
  const token = crypto
    .createHash('sha256')
    .update(`${cfg.bunnySecurityKey}${videoId}${expires}`)
    .digest('hex')

  const url = new URL(`${EMBED_BASE}/${cfg.bunnyLibraryId}/${encodeURIComponent(videoId)}`)
  url.searchParams.set('token', token)
  url.searchParams.set('expires', String(expires))
  // Player chrome, not access control — safe to vary without touching the token,
  // which covers only the video id and the expiry.
  url.searchParams.set('autoplay', 'false')
  url.searchParams.set('preload', 'true')

  return { url: url.toString(), expiresAt: new Date(expires * 1000), ttlSeconds }
}

/**
 * The video state a lesson is actually in, folding in history: lessons from
 * before the upload pipeline (task 22) carry a GUID and no `videoStatus`,
 * because admins pasted GUIDs from the dashboard only after encoding finished
 * — so a bare GUID reads as `ready`. `none` means no video at all.
 */
export const effectiveVideoStatus = (lesson) =>
  lesson.videoStatus || (lesson.bunnyVideoId ? 'ready' : 'none')

/**
 * Removes the video identifiers from a course document before it goes to a
 * browser. Applied to every non-admin course payload — the public course page
 * and the player's curriculum tree alike.
 *
 * A signed URL here would hand over every lesson in the course at once. The raw
 * `bunnyVideoId` is milder, but it is the input a signature is built from, and
 * it is directly playable for as long as Token Authentication is off in the
 * Bunny dashboard — which is a checkbox, not a guarantee. Neither belongs in a
 * response that anyone can fetch.
 *
 * `hasVideo` and `videoStatus` survive so the UI can tell a lesson awaiting
 * upload from one mid-encode from one ready to watch, without learning
 * anything it could play.
 */
export const stripVideoRefs = (course) => {
  if (!course) return course
  return {
    ...course,
    sections: (course.sections || []).map((section) => ({
      ...section,
      lessons: (section.lessons || []).map(({ videoUrl, bunnyVideoId, ...lesson }) => ({
        ...lesson,
        hasVideo: Boolean(bunnyVideoId || videoUrl),
        videoStatus: effectiveVideoStatus({ videoStatus: lesson.videoStatus, bunnyVideoId }),
      })),
    })),
  }
}

/**
 * Finds a lesson inside a course's embedded curriculum. Returns null when the
 * lesson id belongs to a different course — the caller turns that into a 403,
 * not a 404, so the endpoint does not confirm that some other course owns it.
 */
export function findLesson(course, lessonId) {
  for (const section of course.sections || []) {
    for (const lesson of section.lessons || []) {
      if (String(lesson._id) === String(lessonId)) return { section, lesson }
    }
  }
  return null
}
