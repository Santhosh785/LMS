import type { Route } from './+types/claude-skills'
import { staticPageLoader } from '../../lib/pageSeo.server'
import { cacheHeaders, seoMeta } from '../../lib/pageSeo'

export { default } from '../../pages/public/ClaudeSkills.jsx'

export const handle = { bodyClass: 'gs-redesign' }

/** The index renders on the server from the same repo GET /api/resources/skills reads. */
export function loader(args: Route.LoaderArgs) {
  return staticPageLoader(
    '/resources/claude-skills',
    600,
    (context) =>
      context.repos.resources.listPublishedSkills() as Promise<{
        items: Array<Record<string, unknown>>
        categories: Array<{ value: string; label: string; count: number }>
      }>,
  )(args)
}

export const meta = seoMeta
export const headers = cacheHeaders
