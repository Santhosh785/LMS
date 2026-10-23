/**
 * Low-level formatting helpers shared by the mappers and JSON-LD builders.
 *
 * Everything here is plain string/number work: no DOM, no Node built-ins, so
 * the package bundles for the browser and imports in Node unchanged.
 */

/** @typedef {import('./types.js').Site} Site */

export const TITLE_MAX = 60
export const DESCRIPTION_MAX = 160
const ELLIPSIS = '…'

/**
 * Coerce a field to display text. Only strings and finite numbers count;
 * null, undefined, NaN, objects and arrays become '' so no "undefined",
 * "null", "NaN" or "[object Object]" ever reaches a tag.
 * @param {unknown} value
 * @returns {string}
 */
export function text(value) {
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return ''
}

/**
 * Collapse runs of whitespace (including newlines) to single spaces and trim.
 * @param {unknown} value
 * @returns {string}
 */
export function collapse(value) {
  return text(value).replace(/\s+/g, ' ').trim()
}

/**
 * Plain text for a description: tags stripped (CMS excerpts can carry HTML),
 * whitespace collapsed.
 * @param {unknown} value
 * @returns {string}
 */
export function plainText(value) {
  return collapse(text(value).replace(/<[^>]*>/g, ' '))
}

/**
 * Parse a number that may arrive as a number or a numeric string
 * (Postgres `numeric` columns come back as strings). Returns null otherwise.
 * @param {unknown} value
 * @returns {number | null}
 */
export function toNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value.trim())
    return Number.isFinite(n) ? n : null
  }
  return null
}

/**
 * JSON columns may arrive as objects or (from some drivers / caches) as JSON
 * strings. Anything that is not a plain object becomes {}.
 * @param {unknown} value
 * @returns {Record<string, any>}
 */
export function asObject(value) {
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      return {}
    }
  }
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

/**
 * ISO 8601 timestamp from an ISO string or Date; '' when missing or invalid.
 * @param {unknown} value
 * @returns {string}
 */
export function toIsoDate(value) {
  if (value == null || value === '') return ''
  const date = value instanceof Date ? value : new Date(/** @type {any} */ (value))
  const time = date.getTime()
  return Number.isFinite(time) ? date.toISOString() : ''
}

/**
 * Hours as an ISO 8601 duration: 12.5 -> "PT12H30M", 0.25 -> "PT15M".
 * Returns '' for 0, negative, missing or non-numeric input.
 * @param {unknown} hours
 * @returns {string}
 */
export function isoDuration(hours) {
  const h = toNumber(hours)
  if (h == null || h <= 0) return ''
  const totalMinutes = Math.round(h * 60)
  if (totalMinutes <= 0) return ''
  const wholeHours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `PT${wholeHours ? `${wholeHours}H` : ''}${minutes ? `${minutes}M` : ''}`
}

/** The site base URL without trailing slashes. */
function base(site) {
  return text(site?.url).trim().replace(/\/+$/, '')
}

/**
 * Join a relative path to `site.url` (no double slashes). Absolute http(s)
 * URLs pass through untouched; protocol-relative `//host/x` gets `https:`.
 * Empty input returns ''.
 * @param {Site} site
 * @param {unknown} pathOrUrl
 * @returns {string}
 */
export function absoluteUrl(site, pathOrUrl) {
  const value = text(pathOrUrl).trim()
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  if (value.startsWith('//')) return `https:${value}`
  const path = value.replace(/^\/+/, '')
  return `${base(site)}/${path}`
}

/**
 * Canonical URL: absolute, no hash, no query (unless `keepQuery`), no
 * trailing slash. The home page canonical is the bare site URL.
 * @param {Site} site
 * @param {unknown} pathOrUrl
 * @param {{ keepQuery?: boolean }} [options]
 * @returns {string}
 */
export function canonicalUrl(site, pathOrUrl, { keepQuery = false } = {}) {
  let value = text(pathOrUrl).trim().split('#')[0]
  let query = ''
  const q = value.indexOf('?')
  if (q !== -1) {
    query = keepQuery ? value.slice(q) : ''
    value = value.slice(0, q)
  }
  if (query === '?') query = ''
  value = value.replace(/\/+$/, '')
  return `${value ? absoluteUrl(site, value) : base(site)}${query}`
}

/**
 * Cut `value` to at most `max` characters including a trailing ellipsis,
 * preferring a word boundary when one falls in the last 40% of the cut.
 */
function clip(value, max) {
  if (value.length <= max) return value
  if (max <= 1) return value.slice(0, Math.max(max, 0))
  let cut = value.slice(0, max - ELLIPSIS.length)
  // Only back up to a space when the next character does not already start a
  // new word — otherwise the cut already landed on a boundary.
  if (value[cut.length] !== ' ') {
    const space = cut.lastIndexOf(' ')
    if (space > cut.length * 0.6) cut = cut.slice(0, space)
  }
  return `${cut.replace(/[\s.,;:!?\-–—|]+$/, '')}${ELLIPSIS}`
}

/**
 * `<page> | <brand>`, at most ~60 characters. The page part is trimmed (with
 * an ellipsis) so the brand suffix always survives. An empty page part, or one
 * equal to the brand, yields the brand alone; a page part that already ends
 * in "| <brand>" is not suffixed twice.
 * @param {unknown} page
 * @param {Site} site
 * @returns {string}
 */
export function formatTitle(page, site) {
  const brand = collapse(site?.brandName)
  let part = collapse(page)
  if (brand) {
    const lower = brand.toLowerCase()
    // Strip an author-supplied brand suffix ("Foo | Brand", "Foo - Brand").
    const suffixed = part.toLowerCase()
    for (const sep of [' | ', ' - ', ' – ', ' — ']) {
      if (suffixed.endsWith(`${sep}${lower}`)) {
        part = part.slice(0, part.length - sep.length - brand.length).trim()
        break
      }
    }
    if (!part || part.toLowerCase() === lower) return clip(brand, TITLE_MAX)
    const suffix = ` | ${brand}`
    const room = TITLE_MAX - suffix.length
    if (room < 8) return clip(brand, TITLE_MAX)
    return `${clip(part, room)}${suffix}`
  }
  return clip(part, TITLE_MAX)
}

/**
 * Description: tags stripped, whitespace collapsed, clipped to ~160 characters
 * on a word boundary with an ellipsis. Empty input falls back to
 * `site.defaultDescription`.
 * @param {unknown} value
 * @param {Site} site
 * @returns {string}
 */
export function formatDescription(value, site) {
  const body = plainText(value) || plainText(site?.defaultDescription)
  return clip(body, DESCRIPTION_MAX)
}

/**
 * Escape `& < > " '` for HTML text and attribute values. Non-strings are
 * coerced with String(); null/undefined become ''.
 * @param {unknown} value
 * @returns {string}
 */
export function escapeHtml(value) {
  if (value == null) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Drop keys whose value is '', null, undefined, NaN or an empty object, so
 * JSON-LD never carries a hollow property.
 * @template {Record<string, any>} T
 * @param {T} obj
 * @returns {T}
 */
export function compact(obj) {
  /** @type {Record<string, any>} */
  const out = {}
  for (const [key, value] of Object.entries(obj)) {
    if (value == null || value === '') continue
    if (typeof value === 'number' && !Number.isFinite(value)) continue
    if (
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.keys(value).every((k) => k.startsWith('@'))
    ) {
      continue
    }
    out[key] = value
  }
  return /** @type {T} */ (out)
}
