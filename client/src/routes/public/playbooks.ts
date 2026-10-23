import type { Route } from './+types/playbooks'
import { staticPageLoader } from '../../lib/pageSeo.server'
import { cacheHeaders, seoMeta } from '../../lib/pageSeo'

export { default } from '../../pages/public/Playbooks.jsx'

export const handle = { bodyClass: 'gs-redesign' }

/**
 * The index renders on the server from the same repo GET /api/resources/playbooks
 * reads. The "notify me" form keeps posting from the browser.
 */
export function loader(args: Route.LoaderArgs) {
  return staticPageLoader(
    '/resources/playbooks',
    600,
    (context) =>
      context.repos.resources.listPublishedPlaybooks() as Promise<{
        items: Array<Record<string, unknown>>
        tags: string[]
      }>,
  )(args)
}

export const meta = seoMeta
export const headers = cacheHeaders
