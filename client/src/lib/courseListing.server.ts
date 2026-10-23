import { data } from 'react-router'
import type { AppLoadContext } from 'react-router'
import { absoluteUrl, staticMeta, termMeta } from '@gs/seo'
import type { SeoMeta, Site } from '@gs/seo'
import { publicCache } from 'growth-scholar-server/src/middleware/cacheControl.js'
import { seoSite } from 'growth-scholar-server/src/services/seo.js'
import { findPublicTermByName } from 'growth-scholar-server/src/services/taxonomy.js'

import {
  categoryListingParams,
  categoryState,
  exploreListingParams,
  exploreState,
  isFilteredExplore,
} from './courseListing.js'

/**
 * The loaders behind /courses and /courses/category. Server-only (the
 * `.server` suffix makes React Router refuse to bundle it for the browser):
 * it reads the repos from the load context and the term lookup, the SEO site
 * and the cache policy straight from the server, which the Vite config keeps
 * external so these are the very module instances Express is running.
 */

/** A catalogue card as `listPublic` returns it; the pages read it loosely. */
export interface CourseCard {
  _id: string
  slug: string
  title: string
  [key: string]: unknown
}

export interface CourseFacets {
  topics: string[]
  languages: string[]
}

interface CourseRepo {
  listPublic(params: Record<string, unknown>): Promise<{ items: CourseCard[]; total: number }>
  listPublicFacets(): Promise<CourseFacets>
}

const courseRepo = (context: AppLoadContext) => context.repos.courses as unknown as CourseRepo

/**
 * Cache policy for both pages. Shared caches key on the full URL, query string
 * included, so `?topic=A` and `?topic=B` are separate entries; `Vary: Cookie`
 * keeps an anonymous copy from being served to a signed-in visitor, whose page
 * is `private, no-store` anyway.
 */
function cacheHeaders(context: AppLoadContext) {
  return { 'Cache-Control': publicCache(300, Boolean(context.user)), Vary: 'Cookie' }
}

/** ItemList JSON-LD for the cards on the page, in order. */
function courseItemList(items: CourseCard[], site: Site) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: items.map((course, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: absoluteUrl(site, `/courses/${encodeURIComponent(course.slug)}`),
      name: course.title,
    })),
  }
}

const withItemList = (meta: SeoMeta, items: CourseCard[], site: Site): SeoMeta => ({
  ...meta,
  jsonLd: [...meta.jsonLd, courseItemList(items, site)],
})

/** /courses */
export async function loadExplore(request: Request, context: AppLoadContext) {
  const params = new URL(request.url).searchParams
  const state = exploreState(params)
  const repo = courseRepo(context)
  const [listing, facets, site] = await Promise.all([
    repo.listPublic(exploreListingParams(state)),
    repo.listPublicFacets(),
    seoSite(),
  ])

  // Every variant canonicalises to the bare /courses; only that one is indexed.
  const base = staticMeta('/courses', site)
  const seo = withItemList(
    isFilteredExplore(params) ? { ...base, robots: 'noindex, follow' } : base,
    listing.items,
    site,
  )

  return data(
    { items: listing.items, total: listing.total, facets, state, seo },
    { headers: cacheHeaders(context) },
  )
}

/**
 * /courses/category. A `topic` must name a published topic term — anything
 * else is a 404, not an empty listing; no topic at all is the whole catalogue.
 */
export async function loadCategory(request: Request, context: AppLoadContext) {
  const params = new URL(request.url).searchParams
  const state = categoryState(params)
  const repo = courseRepo(context)
  const headers = cacheHeaders(context)
  const [term, listing, facets, site] = await Promise.all([
    state.topic ? findPublicTermByName('topic', state.topic) : null,
    repo.listPublic(categoryListingParams(state)),
    repo.listPublicFacets(),
    seoSite(),
  ])
  if (state.topic && !term) throw data(null, { status: 404, headers })

  // termMeta's canonical is /courses/category?topic=<name> (or the term's own
  // override); every other param is dropped. Without a topic the page carries
  // the same static meta the SEO resolver gives it.
  const seo = withItemList(
    term ? termMeta(term, site) : staticMeta('/courses', site),
    listing.items,
    site,
  )

  return data({ items: listing.items, total: listing.total, facets, state, seo }, { headers })
}

/** The `headers` export for both routes: the loader's (or the 404's) cache policy. */
export function pickCacheHeaders({
  loaderHeaders,
  errorHeaders,
}: {
  loaderHeaders: Headers
  errorHeaders?: Headers
}) {
  const source = errorHeaders ?? loaderHeaders
  const out = new Headers()
  for (const name of ['Cache-Control', 'Vary']) {
    const value = source.get(name)
    if (value) out.set(name, value)
  }
  return out
}
