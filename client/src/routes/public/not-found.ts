import { data } from 'react-router'
import { notFoundMeta } from '@gs/seo'
import type { Route } from './+types/not-found'
import { NO_STORE, seoSite } from '../../lib/pageSeo.server'
import { cacheHeaders, seoMeta } from '../../lib/pageSeo'

export { default } from '../../pages/public/NotFound.jsx'

/** The catch-all: a real 404 with a noindex head, never cached. */
export async function loader(_args: Route.LoaderArgs) {
  return data(
    { seo: notFoundMeta(await seoSite()) },
    { status: 404, headers: { 'Cache-Control': NO_STORE } },
  )
}

export const meta = seoMeta
export const headers = cacheHeaders
