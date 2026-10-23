/**
 * Renderers: SeoMeta -> head HTML string or
 * React Router `meta()` descriptors.
 */

import { escapeHtml, text } from './format.js'

/** @typedef {import('./types.js').SeoMeta} SeoMeta */

// Built from escapes so the source file never holds the raw separators.
const LINE_SEPARATOR = new RegExp(String.fromCharCode(0x2028), 'g')
const PARAGRAPH_SEPARATOR = new RegExp(String.fromCharCode(0x2029), 'g')

/**
 * `<script type="application/ld+json">` for one JSON-LD object. `<`, `>`, `&`
 * and U+2028/U+2029 are written as JSON unicode escapes, so no string inside
 * the data can close the script element or break older JS parsers.
 * @param {unknown} obj
 * @returns {string}
 */
export function jsonLdScript(obj) {
  const json = (JSON.stringify(obj ?? null) ?? 'null')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(LINE_SEPARATOR, '\\u2028')
    .replace(PARAGRAPH_SEPARATOR, '\\u2029')
  return `<script type="application/ld+json">${json}</script>`
}

/** [kind, key, value] for every meta tag, in output order; empties dropped. */
function metaEntries(meta) {
  const m = meta || /** @type {any} */ ({})
  const og = m.og || {}
  const image = text(og.image)
  return /** @type {Array<['name' | 'property', string, string]>} */ (
    [
      ['name', 'description', text(m.description)],
      ['name', 'robots', text(m.robots)],
      ['property', 'og:title', text(m.title)],
      ['property', 'og:description', text(m.description)],
      ['property', 'og:type', text(og.type)],
      ['property', 'og:url', text(og.url)],
      ['property', 'og:image', image],
      ['property', 'og:site_name', text(og.siteName)],
      ['name', 'twitter:card', text(m.twitterCard)],
      ['name', 'twitter:title', text(m.title)],
      ['name', 'twitter:description', text(m.description)],
      ['name', 'twitter:image', image],
    ].filter(([, , value]) => value !== '')
  )
}

const jsonLdList = (meta) => (Array.isArray(meta?.jsonLd) ? meta.jsonLd : []).filter(Boolean)

/**
 * Head tags as one HTML string: title, description, canonical, robots, Open
 * Graph, Twitter and one JSON-LD script per entry. Every text and attribute
 * value is HTML-escaped. Empty values (e.g. the canonical of a 404) are
 * omitted rather than emitted blank.
 * @param {SeoMeta} meta
 * @returns {string}
 */
export function toHeadHtml(meta) {
  const tags = [`<title>${escapeHtml(text(meta?.title))}</title>`]
  const canonical = text(meta?.canonical)
  const canonicalTag = canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}">` : ''
  // The canonical link goes straight after the description meta.
  let placed = false
  for (const [kind, key, value] of metaEntries(meta)) {
    if (!placed && key !== 'description') {
      if (canonicalTag) tags.push(canonicalTag)
      placed = true
    }
    tags.push(`<meta ${kind}="${escapeHtml(key)}" content="${escapeHtml(value)}">`)
  }
  if (!placed && canonicalTag) tags.push(canonicalTag)
  for (const obj of jsonLdList(meta)) tags.push(jsonLdScript(obj))
  return tags.join('\n')
}

/**
 * React Router `meta()` descriptors covering the same tags as toHeadHtml.
 * Values are raw (React escapes them).
 * @param {SeoMeta} meta
 * @returns {Array<Record<string, any>>}
 */
export function toMetaDescriptors(meta) {
  /** @type {Array<Record<string, any>>} */
  const out = [{ title: text(meta?.title) }]
  for (const [kind, key, value] of metaEntries(meta)) out.push({ [kind]: key, content: value })
  const canonical = text(meta?.canonical)
  if (canonical) out.push({ tagName: 'link', rel: 'canonical', href: canonical })
  for (const obj of jsonLdList(meta)) out.push({ 'script:ld+json': obj })
  return out
}
