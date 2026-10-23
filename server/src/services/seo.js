import {
  courseMeta,
  noindexMeta,
  notFoundMeta,
  postMeta,
  programMeta,
  staticMeta,
  termMeta,
  workshopMeta,
} from '@gs/seo'
import { env } from '../config/env.js'
import { findPublicBySlug } from '../db/repos/courses.js'
import { findPublicPostBySlug } from '../db/repos/blog.js'
import { findProgramBySlug } from '../db/repos/programs.js'
import { findWorkshopBySlug } from '../db/repos/workshops.js'
import { getSiteConfig } from './siteConfig.js'
import { findPublicTermByName } from './taxonomy.js'

/**
 * Per-URL page meta for the public site: which `@gs/seo` mapper serves a path,
 * and the record it is fed.
 *
 * The React Router root loader calls this through the load context
 * (middleware/reactRouter.js) for every document request, as the fallback head
 * for a route without its own `meta()` and as the document's status code.
 */

/**
 * The fallback description, used when a page has none of its own. The site
 * settings have no description field yet, so this is the site's
 * long-standing default; a `branding.description`, should the settings grow one,
 * wins over it.
 */
const DEFAULT_DESCRIPTION =
  'Native-language marketing upskilling. Self-paced courses, free starters, and the Complete Growth Marketing Course.'

/**
 * The `Site` every mapper takes. Brand, logo and description come from the
 * cached site config (one query per minute at most, not one per request), and
 * the origin from PUBLIC_URL — never from the request's Host header, which the
 * client controls and which would let anyone mint canonicals on their domain.
 */
export async function seoSite() {
  const branding = (await getSiteConfig())?.branding || {}
  return {
    url: env.siteUrl,
    brandName: branding.brandName || 'Growth Scholar',
    logoUrl: branding.logoUrl || '/logo.png',
    defaultDescription: branding.description || DEFAULT_DESCRIPTION,
  }
}

/**
 * Every route a public detail page is served from. A record that is missing,
 * Draft, Hidden or unpublished comes back from its repo helper as null, and all
 * of those become the same 404 — a draft must not be distinguishable from a
 * slug that never existed.
 */
const detail = (load, toMeta) => async (site, slug) => {
  const record = await load(slug)
  return record ? toMeta(record, site) : notFoundMeta(site)
}

const courseDetail = detail((slug) => findPublicBySlug(slug, { curriculum: false }), courseMeta)
const programDetail = detail(findProgramBySlug, programMeta)
const workshopDetail = detail(findWorkshopBySlug, workshopMeta)
const postDetail = detail(findPublicPostBySlug, postMeta)

/** `/courses/category?topic=<name>`: the topic term, or the catalogue's own meta. */
async function categoryPage(site, _slug, searchParams) {
  const topic = searchParams.get('topic')
  const term = topic ? await findPublicTermByName('topic', topic) : null
  return term ? termMeta(term, site) : staticMeta('/courses', site)
}

const staticPage = (path) => (site) => staticMeta(path, site)
const privatePage = (site) => noindexMeta(site)

/**
 * The route table, tried top to bottom; the first match wins. Patterns are
 * whole, normalised paths: `:slug` is exactly one segment, and `/**` is the
 * prefix itself or anything beneath it.
 *
 * Order is load-bearing. `/courses/category` must be tried before
 * `/courses/:slug`, and `/programs/apply` and `/programs/fit-call` before
 * `/programs/:slug`, or the catch-all would look them up as slugs and 404 —
 * the client router declares them in the same order for the same reason.
 *
 * A playbook or skill detail page gets its section's static meta; their
 * records are not looked up yet, and the sitemap lists only the two sections.
 */
const ROUTES = [
  ['/', staticPage('/')],
  ['/courses', staticPage('/courses')],
  ['/courses/category', categoryPage],
  ['/courses/:slug', courseDetail],
  ['/programs/apply', staticPage('/programs/apply')],
  ['/programs/fit-call', staticPage('/programs/fit-call')],
  ['/programs/:slug', programDetail],
  ['/workshops', staticPage('/workshops')],
  ['/workshops/:slug', workshopDetail],
  ['/blog', staticPage('/blog')],
  ['/blog/:slug', postDetail],
  ...['/about', '/privacy', '/terms', '/refund', '/delivery', '/contact'].map((p) => [
    p,
    staticPage(p),
  ]),
  ...['/login', '/signup', '/forgot-password', '/reset-password'].map((p) => [p, staticPage(p)]),
  ['/resources/playbooks', staticPage('/resources/playbooks')],
  ['/resources/playbooks/:slug', staticPage('/resources/playbooks')],
  ['/resources/claude-skills', staticPage('/resources/claude-skills')],
  ['/resources/claude-skills/:slug', staticPage('/resources/claude-skills')],
  ['/admin/**', privatePage],
  ['/student/**', privatePage],
  ['/community/**', privatePage],
  ['/checkout/**', privatePage],
].map(([pattern, resolve]) => ({ pattern, segments: split(pattern), resolve }))

function split(path) {
  return path.split('/').filter(Boolean)
}

/**
 * Lowercased static segments, so `/About` matches `/about` the way the client
 * router does. The slug keeps its case; every repo lowercases it anyway.
 * Returns `{ slug }` on a match (slug undefined for a static route), else null.
 */
function match(route, parts) {
  const { segments } = route
  const wildcard = segments.at(-1) === '**'
  const fixed = wildcard ? segments.slice(0, -1) : segments
  if (wildcard ? parts.length < fixed.length : parts.length !== fixed.length) return null
  let slug
  for (let i = 0; i < fixed.length; i += 1) {
    if (fixed[i] === ':slug') slug = parts[i]
    else if (fixed[i] !== parts[i].toLowerCase()) return null
  }
  return { slug }
}

/**
 * The path's segments: query and hash dropped, empty segments (trailing or
 * doubled slashes) ignored, each one percent-decoded. A segment that does not
 * decode is not a URL any route serves — null, which resolves to the 404.
 */
function pathSegments(pathname) {
  const path = String(pathname ?? '').split(/[?#]/)[0]
  try {
    return split(path).map((part) => decodeURIComponent(part))
  } catch {
    return null
  }
}

/** URLSearchParams from a URLSearchParams, a query string or an Express `req.query`. */
function toSearchParams(searchParams) {
  if (searchParams instanceof URLSearchParams) return searchParams
  if (typeof searchParams === 'string') return new URLSearchParams(searchParams)
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(searchParams || {})) {
    const first = Array.isArray(value) ? value[0] : value
    if (typeof first === 'string') params.set(key, first)
  }
  return params
}

/**
 * The SeoMeta for a public URL, `status` included: 404 for an unknown path or a
 * detail slug with no public record, otherwise 200 (absent means 200).
 *
 * Only `topic`, on the category route, is read from the query. Everything else
 * in the query string is ignored for matching, and the canonical carries no
 * query the mapper did not put there itself.
 *
 * Throws when the database does; the caller owns the failure policy.
 *
 * @param {string} pathname e.g. "/courses/seo-mastery/"
 * @param {URLSearchParams | string | Record<string, unknown>} [searchParams]
 * @returns {Promise<import('@gs/seo').SeoMeta>}
 */
export async function resolveSeo(pathname, searchParams) {
  const site = await seoSite()
  const parts = pathSegments(pathname)
  if (!parts) return notFoundMeta(site)
  for (const route of ROUTES) {
    const found = match(route, parts)
    if (found) return route.resolve(site, found.slug, toSearchParams(searchParams))
  }
  return notFoundMeta(site)
}

/** The route patterns in match order — exported for the tests. */
export const SEO_ROUTE_PATTERNS = Object.freeze(ROUTES.map((r) => r.pattern))
