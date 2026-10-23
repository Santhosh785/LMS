/**
 * Schema.org JSON-LD builders. Each returns a plain object with
 * `@context: "https://schema.org"` and an `@type`. Missing optional inputs
 * drop the property rather than emitting empty or "undefined" values.
 */

import {
  absoluteUrl,
  asObject,
  canonicalUrl,
  collapse,
  compact,
  formatDescription,
  isoDuration,
  plainText,
  text,
  toIsoDate,
  toNumber,
} from './format.js'

/** @typedef {import('./types.js').Site} Site */
/** @typedef {import('./types.js').BreadcrumbItem} BreadcrumbItem */

const CONTEXT = 'https://schema.org'
const CURRENCY = 'INR'
const IN_STOCK = 'https://schema.org/InStock'

/** URL-safe slug segment ('' when missing). */
export function segment(slug) {
  const value = collapse(slug)
  return value ? encodeURIComponent(value) : ''
}

export const coursePath = (slug) => `/courses/${segment(slug)}`
export const programPath = (slug) => `/programs/${segment(slug)}`
export const workshopPath = (slug) => `/workshops/${segment(slug)}`
export const postPath = (slug) => `/blog/${segment(slug)}`

/** Organization node without @context, for nesting (provider, publisher…). */
function orgNode(site) {
  return compact({
    '@type': 'Organization',
    name: collapse(site?.brandName),
    url: canonicalUrl(site, '/'),
    logo: absoluteUrl(site, site?.logoUrl),
  })
}

/**
 * @param {Site} site
 * @returns {object}
 */
export function organization(site) {
  return { '@context': CONTEXT, ...orgNode(site) }
}

/**
 * @param {Site} site
 * @returns {object}
 */
export function webSite(site) {
  return compact({
    '@context': CONTEXT,
    '@type': 'WebSite',
    name: collapse(site?.brandName),
    url: canonicalUrl(site, '/'),
  })
}

/**
 * `Course` with provider, INR offer and an online CourseInstance.
 * @param {Record<string, any>} course
 * @param {Site} site
 * @returns {object}
 */
export function course(course, site) {
  const c = asObject(course)
  const url = canonicalUrl(site, coursePath(c.slug))
  const amount = toNumber(c.amount)
  const free = collapse(c.price).toLowerCase() === 'free' || !(amount != null && amount > 0)
  const rating = toNumber(c.rating)
  const ratingCount = toNumber(c.ratingCount)
  const reviewCount = toNumber(c.reviewCount)
  const hasCount =
    (ratingCount != null && ratingCount > 0) || (reviewCount != null && reviewCount > 0)

  return compact({
    '@context': CONTEXT,
    '@type': 'Course',
    name: collapse(c.title),
    description: formatDescription(c.summary, site),
    url,
    image: absoluteUrl(site, c.image),
    provider: orgNode(site),
    offers: compact({
      '@type': 'Offer',
      category: free ? 'Free' : 'Paid',
      price: free ? 0 : amount,
      priceCurrency: CURRENCY,
      availability: IN_STOCK,
      url,
    }),
    hasCourseInstance: compact({
      '@type': 'CourseInstance',
      courseMode: 'Online',
      courseWorkload: isoDuration(c.hours),
    }),
    aggregateRating:
      rating != null && rating > 0 && hasCount
        ? compact({
            '@type': 'AggregateRating',
            ratingValue: rating,
            bestRating: 5,
            ratingCount: ratingCount != null && ratingCount > 0 ? ratingCount : null,
            reviewCount: reviewCount != null && reviewCount > 0 ? reviewCount : null,
          })
        : null,
  })
}

/** Author name from a JSON author column (object, JSON string or bare name). */
function authorName(author) {
  if (typeof author === 'string') {
    const parsed = asObject(author)
    return collapse(Object.keys(parsed).length ? parsed.name : author)
  }
  return collapse(asObject(author).name)
}

/**
 * `BlogPosting`. dateModified falls back to datePublished; author falls back
 * to the site Organization.
 * @param {Record<string, any>} post
 * @param {Site} site
 * @returns {object}
 */
export function blogPosting(post, site) {
  const p = asObject(post)
  const seo = asObject(p.seo)
  const url = canonicalUrl(site, postPath(p.slug))
  const published = toIsoDate(p.publishedAt)
  const name = authorName(p.author)

  return compact({
    '@context': CONTEXT,
    '@type': 'BlogPosting',
    headline: collapse(p.title),
    description: formatDescription(plainText(p.excerpt) || plainText(seo.metaDescription), site),
    image: absoluteUrl(site, collapse(p.image) || collapse(seo.ogImage)),
    datePublished: published,
    dateModified: toIsoDate(p.updatedAt) || published,
    author: name ? { '@type': 'Person', name } : orgNode(site),
    publisher: orgNode(site),
    articleSection: collapse(p.category),
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
  })
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/** Workshops are scheduled in India; IST has no DST, so a fixed offset is exact. */
const IST_OFFSET_MS = 330 * 60 * 1000

/**
 * "12 Nov 2026" in IST. Deterministic (no Intl / local time zone), so server
 * and client render identical text and hydration never mismatches.
 */
function formatIstDate(iso) {
  if (!iso) return ''
  const d = new Date(new Date(iso).getTime() + IST_OFFSET_MS)
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

const isOffline = (workshop) => collapse(workshop?.mode).toLowerCase() === 'offline'

/**
 * Workshops have no description column, so one is composed from the
 * schedule fields: "Online workshop on 12 Nov 2026. Duration: 2 hours. …"
 * @param {Record<string, any>} workshop
 * @returns {string}
 */
export function workshopDescription(workshop) {
  const w = asObject(workshop)
  const own = plainText(w.description) || plainText(w.summary)
  const venue = collapse(w.venue)
  const date = formatIstDate(toIsoDate(w.startsAt))
  let lead = `${isOffline(w) ? 'In-person' : 'Online'} workshop`
  if (isOffline(w) && venue) lead += ` at ${venue}`
  if (date) lead += ` on ${date}`
  const parts = [own, `${lead}.`]
  if (collapse(w.durationLabel)) parts.push(`Duration: ${collapse(w.durationLabel)}.`)
  if (collapse(w.host)) parts.push(`Hosted by ${collapse(w.host)}.`)
  if (collapse(w.level)) parts.push(`Level: ${collapse(w.level)}.`)
  return parts.filter(Boolean).join(' ')
}

/**
 * `Event` for a workshop: online -> VirtualLocation, offline -> Place.
 * @param {Record<string, any>} workshop
 * @param {Site} site
 * @returns {object}
 */
export function event(workshop, site) {
  const w = asObject(workshop)
  const url = canonicalUrl(site, workshopPath(w.slug))
  const offline = isOffline(w)
  const venue = collapse(w.venue)
  const price = toNumber(w.priceNew)
  const host = collapse(w.host)

  return compact({
    '@context': CONTEXT,
    '@type': 'Event',
    name: collapse(w.title),
    description: formatDescription(workshopDescription(w), site),
    image: absoluteUrl(site, w.image),
    url,
    startDate: toIsoDate(w.startsAt),
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: offline
      ? 'https://schema.org/OfflineEventAttendanceMode'
      : 'https://schema.org/OnlineEventAttendanceMode',
    location: offline
      ? compact({ '@type': 'Place', name: venue, address: venue })
      : { '@type': 'VirtualLocation', url },
    organizer: orgNode(site),
    performer: host ? { '@type': 'Person', name: host } : null,
    offers: compact({
      '@type': 'Offer',
      price: price != null && price >= 0 ? price : null,
      priceCurrency: CURRENCY,
      availability: IN_STOCK,
      url,
    }),
  })
}

/**
 * @param {BreadcrumbItem[]} items `{ name, url }`, in order from the root.
 * @returns {object}
 */
export function breadcrumbList(items) {
  const list = (Array.isArray(items) ? items : []).filter((item) => collapse(item?.name))
  return {
    '@context': CONTEXT,
    '@type': 'BreadcrumbList',
    itemListElement: list.map((item, i) =>
      compact({
        '@type': 'ListItem',
        position: i + 1,
        name: collapse(item.name),
        item: text(item.url).trim(),
      }),
    ),
  }
}

/**
 * @param {string[]} urls
 * @returns {object}
 */
export function itemList(urls) {
  const list = (Array.isArray(urls) ? urls : []).map((u) => text(u).trim()).filter(Boolean)
  return {
    '@context': CONTEXT,
    '@type': 'ItemList',
    itemListElement: list.map((url, i) => ({ '@type': 'ListItem', position: i + 1, url })),
  }
}
