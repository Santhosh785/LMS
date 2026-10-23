import { and, asc, eq } from 'drizzle-orm'
import { env } from '../config/env.js'
import { db } from '../db/index.js'
import { terms } from '../db/schema/index.js'
import { listPublicCourseSlugs } from '../db/repos/courses.js'
import { listPublicPostSlugs } from '../db/repos/blog.js'
import { listProgramSlugs } from '../db/repos/programs.js'
import { listWorkshopSlugs } from '../db/repos/workshops.js'

/**
 * /sitemap.xml and /robots.txt.
 *
 * Visibility is not decided here. Courses and posts come from the repo helpers
 * that the public API also reads, so a Draft course cannot appear in the
 * sitemap while 404ing on its page, or the other way round.
 */

/** Public pages with no slug behind them. No `lastmod`: they have no row to date them. */
export const STATIC_SITEMAP_PATHS = Object.freeze([
  '/',
  '/courses',
  '/workshops',
  '/blog',
  '/about',
  '/privacy',
  '/terms',
  '/refund',
  '/delivery',
  '/contact',
  '/resources/playbooks',
  '/resources/claude-skills',
])

/** Private or transactional paths. Search engines get nothing useful from them. */
export const ROBOTS_DISALLOW = Object.freeze([
  '/admin',
  '/student',
  '/community',
  '/api',
  '/checkout',
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/uploads',
])

const XML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }

export function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => XML_ESCAPES[ch])
}

/** YYYY-MM-DD, or null when the value is not a usable date. */
function isoDate(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
}

/**
 * Topic terms the public catalogue offers as a filter. Hidden or unpublished
 * terms are excluded too: the public config never sends them to the browser.
 */
function listFilterTopics() {
  return db
    .select({ name: terms.name })
    .from(terms)
    .where(
      and(
        eq(terms.taxonomy, 'topic'),
        eq(terms.showInFilters, true),
        eq(terms.status, 'Published'),
        eq(terms.visibility, 'Public'),
      ),
    )
    .orderBy(asc(terms.order), asc(terms.name))
}

function urlEntry(loc, lastmod) {
  const lines = [`    <loc>${escapeXml(loc)}</loc>`]
  if (lastmod) lines.push(`    <lastmod>${lastmod}</lastmod>`)
  return `  <url>\n${lines.join('\n')}\n  </url>`
}

/** Builds the sitemap document from the database. Not memoized; see `getSitemap`. */
export async function buildSitemap(base = env.siteUrl) {
  const [courses, programs, workshops, posts, topics] = await Promise.all([
    listPublicCourseSlugs(),
    listProgramSlugs(),
    listWorkshopSlugs(),
    listPublicPostSlugs(),
    listFilterTopics(),
  ])

  // Slugs are URL-safe by construction, but encode them anyway: one odd
  // character from an import would otherwise produce an invalid URL.
  const slugged = (prefix, rows) =>
    rows.map((r) =>
      urlEntry(`${base}${prefix}/${encodeURIComponent(r.slug)}`, isoDate(r.updatedAt)),
    )

  const entries = [
    ...STATIC_SITEMAP_PATHS.map((p) => urlEntry(`${base}${p}`)),
    ...slugged('/courses', courses),
    ...slugged('/programs', programs),
    ...slugged('/workshops', workshops),
    ...slugged('/blog', posts),
    ...topics.map((t) => urlEntry(`${base}/courses/category?topic=${encodeURIComponent(t.name)}`)),
  ]

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    '</urlset>',
    '',
  ].join('\n')
}

/*
 * The in-flight promise is cached rather than the string, so a crawler burst on
 * a cold cache shares one set of queries. A failed build is not cached.
 */
const TTL_MS = 10 * 60_000
let cached = null
let cachedAt = 0

/** Clears the memo, so the next request regenerates the sitemap. */
export function invalidateSitemap() {
  cached = null
  cachedAt = 0
}

/** The sitemap XML, memoized in-process for 10 minutes. */
export function getSitemap() {
  if (cached && Date.now() - cachedAt < TTL_MS) return cached
  const pending = buildSitemap()
  cached = pending
  cachedAt = Date.now()
  pending.catch(() => {
    if (cached === pending) invalidateSitemap()
  })
  return pending
}

export function robotsTxt(base = env.siteUrl) {
  return [
    'User-agent: *',
    ...ROBOTS_DISALLOW.map((p) => `Disallow: ${p}`),
    '',
    `Sitemap: ${base}/sitemap.xml`,
    '',
  ].join('\n')
}
