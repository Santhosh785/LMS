import crypto from 'node:crypto'
import { cfg } from './runtimeConfig.js'

/**
 * Bunny Stream management API (task 22 — in-app video upload).
 *
 * services/bunny.js signs *playback*: it needs only the library id and the
 * token-authentication key, and stays usable when this file is unconfigured.
 * This file is the *management* side — creating a video object before upload,
 * reading its encoding status, deleting it — all of which need the library
 * API key, which never leaves the server.
 *
 * The upload itself never touches this server. The browser uploads straight to
 * Bunny over TUS (resumable, so a dropped hotel wifi connection resumes instead
 * of restarting a 2GB file), authorised by a per-video signature computed here:
 *
 *   signature = sha256_hex(libraryId + apiKey + expires + videoId)
 *
 * That signature authorises exactly one video id for a bounded time — the API
 * key itself stays server-side.
 */

const API_BASE = 'https://video.bunnycdn.com/library'

/** TUS endpoint the browser uploads to, returned alongside every presign. */
export const TUS_ENDPOINT = 'https://video.bunnycdn.com/tusupload'

/**
 * Six hours. An upload signature must outlive the whole upload, including
 * pauses and resumes on a bad connection — a 2GB lecture on a 4Mbps uplink is
 * already ~75 minutes of pure transfer. Unlike a playback URL, leaking one
 * authorises writing to a single just-created video id, not reading anything.
 */
export const UPLOAD_TTL_SECONDS = 6 * 60 * 60

export const isBunnyManagementConfigured = () => Boolean(cfg.bunnyLibraryId && cfg.bunnyApiKey)

/**
 * Bunny's video `status` field, mapped to the three states the UI cares about.
 * (0 created, 1 uploaded, 2 processing, 3 transcoding, 4 finished,
 * 5 error, 6 upload failed, 7+ JIT states.) "Finished" is the only state where
 * every resolution is guaranteed playable, so that alone maps to `ready`.
 */
export function mapBunnyStatus(status) {
  const n = Number(status)
  if (n === 4) return 'ready'
  if (n === 5 || n === 6) return 'failed'
  return 'processing'
}

async function bunnyFetch(path, { method = 'GET', body } = {}) {
  if (!isBunnyManagementConfigured()) {
    throw new Error('Bunny management API is not configured (BUNNY_LIBRARY_ID / BUNNY_API_KEY)')
  }
  const res = await fetch(`${API_BASE}/${cfg.bunnyLibraryId}${path}`, {
    method,
    headers: {
      AccessKey: cfg.bunnyApiKey,
      accept: 'application/json',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    // The Bunny error body is not forwarded to clients — route handlers turn
    // this into a 502 with a generic message, so nothing upstream leaks.
    const detail = await res.text().catch(() => '')
    const err = new Error(`Bunny API ${method} ${path} failed: ${res.status} ${detail}`.trim())
    err.status = res.status
    throw err
  }
  // DELETE returns a body too, but nothing downstream needs it parsed strictly.
  return res.json().catch(() => ({}))
}

/**
 * Creates the video object a TUS upload attaches to.
 * @returns {{ guid: string }} plus whatever else Bunny sends.
 */
export const createVideo = (title) => bunnyFetch('/videos', { method: 'POST', body: { title } })

/** @returns the video object — `status` (see mapBunnyStatus) and `length` in seconds. */
export const getVideo = (videoId) => bunnyFetch(`/videos/${encodeURIComponent(videoId)}`)

/**
 * Best-effort delete for replace/remove flows. A video Bunny has already lost
 * track of is the desired end state, not a failure — 404 is swallowed.
 */
export async function deleteVideo(videoId) {
  try {
    await bunnyFetch(`/videos/${encodeURIComponent(videoId)}`, { method: 'DELETE' })
    return true
  } catch (err) {
    if (err.status === 404) return true
    throw err
  }
}

/**
 * The browser-side authorisation for one TUS upload: headers exactly as
 * Bunny's TUS scheme expects them, minus the API key they were derived from.
 */
export function signTusUpload(videoId, { ttlSeconds = UPLOAD_TTL_SECONDS } = {}) {
  if (!videoId) throw new Error('signTusUpload: videoId is required')
  if (!isBunnyManagementConfigured()) {
    throw new Error('Bunny management API is not configured (BUNNY_LIBRARY_ID / BUNNY_API_KEY)')
  }
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds
  const signature = crypto
    .createHash('sha256')
    .update(`${cfg.bunnyLibraryId}${cfg.bunnyApiKey}${expires}${videoId}`)
    .digest('hex')

  return {
    endpoint: TUS_ENDPOINT,
    headers: {
      AuthorizationSignature: signature,
      AuthorizationExpire: expires,
      VideoId: videoId,
      LibraryId: cfg.bunnyLibraryId,
    },
  }
}
