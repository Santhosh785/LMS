import { data } from 'react-router'
import { notFoundMeta, toMetaDescriptors, workshopMeta } from '@gs/seo'
import type { Site, WorkshopInput } from '@gs/seo'
// Server-only: both are used by the loader alone, which the client build
// strips together with these imports. The server workspace is external to the
// SSR bundle (vite.config.js), so this is the module instance Express loaded.
import { publicCache } from 'growth-scholar-server/src/middleware/cacheControl.js'
import { seoSite } from 'growth-scholar-server/src/services/seo.js'

import type { Route } from './+types/workshop-detail'

export { default } from '../../pages/public/WorkshopDetail.jsx'

/** The page scope the redesign stylesheets key on, applied on first paint. */
export const handle = { bodyClass: 'gs-redesign wl-page' }

/** A workshop row as the repo returns it (the columns the page and meta read). */
export interface Workshop extends WorkshopInput {
  id: string
  title: string
  slug: string
  registeredCount?: number | null
  landing?: Record<string, unknown> | null
}

/** The session cookies set by server/src/middleware/auth.js. */
const SESSION_COOKIE = /(?:^|;\s*)gs_(?:at|rt)=/

/**
 * A signed-in request, or one carrying a session cookie the auth middleware
 * could not turn into a user: either way the response may be personal (or
 * carry a refreshed/cleared cookie) and must not sit in a shared cache.
 */
function hasSession(request: Request, user: unknown) {
  return Boolean(user) || SESSION_COOKIE.test(request.headers.get('cookie') ?? '')
}

/**
 * The workshop by slug, straight from the repo layer, so the first HTML
 * already carries the page (registered count included). An unknown slug is a
 * 404 data response the page renders as "Workshop not found" — not a thrown
 * error, so the public chrome and the page's own not-found view stay.
 */
export async function loader({ params, request, context }: Route.LoaderArgs) {
  const findBySlug = context.repos.workshops.findWorkshopBySlug as unknown as (
    slug: string,
  ) => Promise<Workshop | null>
  const [workshop, site] = await Promise.all([findBySlug(params.slug), seoSite() as Promise<Site>])
  const hasUser = hasSession(request, context.user)

  if (!workshop) {
    // An error is never shared-cached as if it were the page: the helper's
    // non-shareable answer, whoever asked.
    return data(
      { workshop: null, site },
      { status: 404, headers: { 'Cache-Control': publicCache(0, true) } },
    )
  }
  return data({ workshop, site }, { headers: { 'Cache-Control': publicCache(600, hasUser) } })
}

/** The loader's Cache-Control; a thrown loader error falls back to no-store. */
export const headers: Route.HeadersFunction = ({ loaderHeaders }) => ({
  'Cache-Control': loaderHeaders.get('Cache-Control') ?? 'no-store',
})

/**
 * Title, description, canonical, Open Graph, Twitter, Event and BreadcrumbList
 * JSON-LD from `workshopMeta`. A free workshop (no price, or zero) is offered
 * at price 0 rather than with the price omitted.
 */
export const meta: Route.MetaFunction = ({ data: loaderData }) => {
  if (!loaderData) return [{ title: 'Workshop not found' }, { name: 'robots', content: 'noindex' }]
  const { workshop, site } = loaderData
  if (!workshop) return toMetaDescriptors(notFoundMeta(site))
  return toMetaDescriptors(
    workshopMeta({ ...workshop, priceNew: Number(workshop.priceNew) || 0 }, site),
  )
}
