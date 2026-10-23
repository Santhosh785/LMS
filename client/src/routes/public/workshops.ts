import { data } from 'react-router'
import type { Route } from './+types/workshops'
import { listingCacheHeaders, listingSite, workshopsRepo } from '../../lib/listing.server'
import { listingMeta } from '../../lib/listingMeta'
import { DEFAULT_WORKSHOP_MODE, groupWorkshops, workshopMode } from '../../lib/workshopGroups.js'

export { default } from '../../pages/public/Workshops.jsx'

export const handle = { bodyClass: 'gs-redesign' }

/**
 * /workshops[?mode=offline]: the workshops of one format, from the same repo
 * query GET /api/workshops runs. An unknown mode is the default (online).
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const mode = workshopMode(new URL(request.url).searchParams.get('mode'))
  const items = await workshopsRepo(context).listWorkshops({ mode })
  return data(
    { mode, items, site: listingSite(context) },
    { headers: listingCacheHeaders(context) },
  )
}

export const headers: Route.HeadersFunction = ({ loaderHeaders }) => ({
  'Cache-Control': loaderHeaders.get('Cache-Control') ?? 'private, no-store',
})

export const meta: Route.MetaFunction = ({ data: page }) => {
  if (!page) return [{ title: 'Workshops | Growth Scholar' }]
  return listingMeta({
    site: page.site,
    path: '/workshops',
    title: 'Workshops',
    params: [['mode', page.mode === DEFAULT_WORKSHOP_MODE ? null : page.mode]],
    items: groupWorkshops(page.mode, page.items)
      .flatMap((group) => group.items)
      .map((w) => ({ path: `/workshops/${encodeURIComponent(String(w.slug))}`, name: w.title })),
  })
}
