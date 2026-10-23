import { env } from '../config/env.js'
import { defineJob } from '../services/queue.js'

/**
 * Job `purge-cloudflare-cache` — data `{ urls }` (site-relative paths) or
 * `{ everything: true }`.
 *
 * Queued by every content change (services/contentEvents.js) so the edge stops
 * serving the old page. Calls Cloudflare's zone purge endpoint:
 *
 *   POST https://api.cloudflare.com/client/v4/zones/{CF_ZONE_ID}/purge_cache
 *   Authorization: Bearer {CF_API_TOKEN}
 *   { "files": [ ...absolute URLs, at most 30 ] }  or  { "purge_everything": true }
 *
 * Paths are made absolute against PUBLIC_URL (`env.siteUrl`), which must be the
 * origin Cloudflare caches under, or the purge matches nothing.
 *
 * Without CF_ZONE_ID or CF_API_TOKEN the job completes as a no-op and says so
 * once per process — local development and tests never reach Cloudflare. Any
 * non-2xx response (or a body with `success: false`) throws, so the queue
 * retries the whole job; purging a URL twice is harmless.
 */

export const CLOUDFLARE_API = 'https://api.cloudflare.com/client/v4'
/** Cloudflare's per-request limit for purge by URL on most plans. */
export const PURGE_BATCH_SIZE = 30
const REQUEST_TIMEOUT_MS = 15_000

export class CloudflarePurgeError extends Error {
  constructor(status, detail) {
    super(`Cloudflare purge failed (HTTP ${status})${detail ? `: ${detail}` : ''}`)
    this.name = 'CloudflarePurgeError'
    this.status = status
  }
}

/** Absolute, de-duplicated URLs for a list of paths. Already-absolute URLs pass through. */
export function absoluteUrls(paths, siteUrl) {
  const base = String(siteUrl || '').replace(/\/+$/, '')
  const out = new Set()
  for (const path of paths || []) {
    if (typeof path !== 'string' || !path) continue
    out.add(/^https?:\/\//i.test(path) ? path : `${base}${path.startsWith('/') ? '' : '/'}${path}`)
  }
  return [...out]
}

export function chunk(list, size) {
  const out = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

async function errorDetail(res) {
  try {
    const body = await res.json()
    const messages = (body?.errors || []).map((e) => e?.message).filter(Boolean)
    return messages.join('; ')
  } catch {
    return ''
  }
}

/**
 * Builds the job handler. Everything external is injectable so the batching,
 * the once-only warning and the failure path are testable without a network;
 * the registered job uses the process environment and the global `fetch`.
 */
export function createCloudflarePurge({
  zoneId = env.cloudflare.zoneId,
  apiToken = env.cloudflare.apiToken,
  siteUrl = env.siteUrl,
  fetch: fetchImpl = (...args) => globalThis.fetch(...args),
  logger = console,
} = {}) {
  let warned = false

  async function request(body) {
    const res = await fetchImpl(
      `${CLOUDFLARE_API}/zones/${encodeURIComponent(zoneId)}/purge_cache`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      },
    )
    if (!res.ok) throw new CloudflarePurgeError(res.status, await errorDetail(res))
    const payload = await res.json().catch(() => null)
    if (payload && payload.success === false) {
      throw new CloudflarePurgeError(
        res.status,
        (payload.errors || []).map((e) => e?.message).join('; '),
      )
    }
  }

  return async function purgeCloudflareCache({ urls, everything } = {}) {
    if (!zoneId || !apiToken) {
      if (!warned) {
        warned = true
        logger.log('[cloudflare] CF_ZONE_ID / CF_API_TOKEN not set — edge cache purges are skipped')
      }
      return { skipped: 'unconfigured' }
    }

    if (everything === true) {
      await request({ purge_everything: true })
      return { purged: 'everything' }
    }

    const files = absoluteUrls(urls, siteUrl)
    if (!files.length) return { purged: 0 }
    // Sequential: a failed batch stops the job, and the retry starts over.
    for (const batch of chunk(files, PURGE_BATCH_SIZE)) await request({ files: batch })
    return { purged: files.length }
  }
}

defineJob('purge-cloudflare-cache', { handler: createCloudflarePurge() })
