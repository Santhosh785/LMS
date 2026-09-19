import crypto from 'node:crypto'
import path from 'node:path'
import { cfg } from './runtimeConfig.js'

/**
 * Bunny Storage — the object store behind the Media Library.
 *
 * This is a different Bunny product from the two services next to it:
 * services/bunny.js signs Stream *playback* and services/bunnyApi.js drives the
 * Stream *management* API. Neither can hold a JPEG. Bunny Storage is a plain
 * file store, addressed as
 *
 *   https://{region}storage.bunnycdn.com/{zone}/{path}
 *
 * with the zone password in an `AccessKey` header, and served to the public
 * through a Pull Zone hostname (`{something}.b-cdn.net`).
 *
 * ## Why uploads proxy through this server
 *
 * Video uploads go straight from the browser to Bunny, because Stream can mint
 * a signature that authorises exactly one video id for a bounded time. Storage
 * has no equivalent: the zone password is a bearer credential for the whole
 * zone, with no per-object or per-expiry scoping. Handing it to a browser would
 * give any admin's devtools — or any XSS on the admin origin — permanent write
 * and delete access to every file. So the bytes pass through here, where the
 * password stays. Images are small enough (10MB cap) that the extra hop costs
 * nothing; a 2GB lecture video would be a different calculation, which is
 * exactly why Stream does it the other way.
 */

/** Bunny's storage regions. '' is the default zone (Falkenstein, DE). */
export const STORAGE_REGIONS = [
  ['', 'Germany (default)'],
  ['uk', 'United Kingdom'],
  ['se', 'Sweden'],
  ['ny', 'New York'],
  ['la', 'Los Angeles'],
  ['sg', 'Singapore'],
  ['syd', 'Sydney'],
  ['br', 'Brazil'],
  ['jh', 'Johannesburg'],
]
const REGION_CODES = new Set(STORAGE_REGIONS.map(([code]) => code))

/**
 * Bunny's dashboard labels the default zone "DE", but its endpoint has no
 * prefix at all — `de.storage.bunnycdn.com` does not resolve. Typing what the
 * dashboard shows is the obvious thing to do, so it is accepted here.
 */
const REGION_ALIASES = { de: '', germany: '', falkenstein: '' }
let warnedRegion = ''

/**
 * Resolves a configured region to an endpoint prefix.
 *
 * An unrecognised code is a typo, and silently falling back to Germany would
 * put every upload in the wrong datacentre — or, more often, produce a 404 that
 * looks like bad credentials. It falls back anyway, because refusing to store
 * anything is worse, but it says so once.
 */
function regionPrefix(raw) {
  const value = String(raw || '').trim().toLowerCase()
  if (!value) return ''
  if (value in REGION_ALIASES) return REGION_ALIASES[value]
  if (REGION_CODES.has(value)) return value
  if (warnedRegion !== value) {
    warnedRegion = value
    console.warn(
      `[bunny-storage] Unknown region "${raw}" — using the default (Germany) endpoint. ` +
        `Valid codes: ${STORAGE_REGIONS.map(([code]) => code || "'' (Germany)").join(', ')}.`,
    )
  }
  return ''
}

/**
 * Which required settings are still blank.
 *
 * All three are needed before anything can be stored: the zone and password to
 * write, the CDN hostname to build a URL a visitor can actually open. Filling
 * in two of the three leaves uploads silently on local disk, so the missing
 * ones are named rather than left to be guessed at.
 */
export function storageGaps() {
  const { zone, password, host } = cfg.bunnyStorage
  return [
    !zone && 'storage zone name',
    !password && 'storage password',
    !host && 'CDN hostname',
  ].filter(Boolean)
}

export const isBunnyStorageConfigured = () => storageGaps().length === 0

const apiHost = () => {
  const region = regionPrefix(cfg.bunnyStorage.region)
  return region ? `${region}.storage.bunnycdn.com` : 'storage.bunnycdn.com'
}

const endpoint = (objectPath = '') =>
  `https://${apiHost()}/${encodeURIComponent(cfg.bunnyStorage.zone)}/${objectPath
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`

/**
 * The public URL for a stored object.
 *
 * Built from the Pull Zone hostname rather than the storage endpoint — the
 * storage API is not public, and linking a browser at it would 401. An operator
 * may paste the hostname with or without a scheme.
 */
export function publicUrl(objectPath) {
  const host = String(cfg.bunnyStorage.host || '').trim().replace(/^https?:\/\//, '').replace(/\/+$/, '')
  if (!host) return ''
  return `https://${host}/${objectPath.split('/').map(encodeURIComponent).join('/')}`
}

/**
 * Where a new upload lands: `blog/YYYY/MM/<uuid>.<ext>`.
 *
 * Date-partitioned like WordPress's own uploads directory, so the zone stays
 * browsable in Bunny's file manager once it holds thousands of files. The name
 * is a UUID rather than the original filename — two editors uploading
 * `header.jpg` in the same month must not overwrite each other, and an
 * attacker-chosen filename never reaches a path.
 */
export function objectPathFor(originalName, now = new Date()) {
  const ext = path.extname(String(originalName || '')).toLowerCase().replace(/[^a-z0-9.]/g, '').slice(0, 10)
  const year = now.getUTCFullYear()
  const month = String(now.getUTCMonth() + 1).padStart(2, '0')
  return `blog/${year}/${month}/${crypto.randomUUID()}${ext || '.bin'}`
}

function assertConfigured() {
  if (!isBunnyStorageConfigured()) {
    throw new Error('Bunny Storage is not configured (zone, password and CDN hostname are required)')
  }
}

async function storageFetch(objectPath, { method = 'GET', body, contentType, checksum } = {}) {
  assertConfigured()
  const res = await fetch(endpoint(objectPath), {
    method,
    headers: {
      AccessKey: cfg.bunnyStorage.password,
      accept: 'application/json',
      ...(contentType ? { 'content-type': contentType } : {}),
      // Bunny verifies this and rejects a body that does not match, so a
      // truncated upload fails loudly instead of storing a corrupt image.
      ...(checksum ? { Checksum: checksum } : {}),
      ...(body ? { 'content-length': String(body.length) } : {}),
    },
    body,
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    const err = new Error(`Bunny Storage ${method} failed: ${res.status} ${detail}`.trim())
    err.status = res.status
    throw err
  }
  return res
}

/**
 * Uploads a buffer and returns where it landed.
 * @returns {{ path: string, url: string, size: number }}
 */
export async function putObject(objectPath, buffer, contentType) {
  const checksum = crypto.createHash('sha256').update(buffer).digest('hex').toUpperCase()
  await storageFetch(objectPath, { method: 'PUT', body: buffer, contentType, checksum })
  return { path: objectPath, url: publicUrl(objectPath), size: buffer.length }
}

/** Reads an object back, for rebuilding derivatives from the stored original. */
export async function getObject(objectPath) {
  const res = await storageFetch(objectPath)
  return Buffer.from(await res.arrayBuffer())
}

/**
 * Best-effort delete. A file Bunny has already lost is the desired end state,
 * so 404 counts as success — the same rule deleteVideo() uses.
 */
export async function deleteObject(objectPath) {
  try {
    await storageFetch(objectPath, { method: 'DELETE' })
    return true
  } catch (err) {
    if (err.status === 404) return true
    throw err
  }
}

/**
 * Proves the credentials work, rather than only that they are present: lists
 * the zone root, which needs a valid password and nothing else.
 */
export async function testConnection() {
  assertConfigured()
  const res = await fetch(`https://${apiHost()}/${encodeURIComponent(cfg.bunnyStorage.zone)}/`, {
    headers: { AccessKey: cfg.bunnyStorage.password, accept: 'application/json' },
  })
  if (res.status === 401) throw new Error('Bunny rejected the storage password')
  if (res.status === 404) throw new Error(`No storage zone named “${cfg.bunnyStorage.zone}” in this region`)
  if (!res.ok) throw new Error(`Bunny Storage returned ${res.status}`)
  const items = await res.json().catch(() => [])
  return { files: Array.isArray(items) ? items.length : 0 }
}
