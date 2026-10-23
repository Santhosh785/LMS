import { data } from 'react-router'
import type { Route } from './+types/playbook-detail'
import { cacheControl, notFound, resourceItemMeta, seoSite } from '../../lib/pageSeo.server'
import { cacheHeaders, seoMeta } from '../../lib/pageSeo'

// The error boundary renders the page's own "Playbook not found" copy for a 404.
export { default, ErrorBoundary } from '../../pages/public/PlaybookDetail.jsx'

export const handle = { bodyClass: 'gs-redesign' }

const SECTION = '/resources/playbooks'
const MAX_AGE = 600

type Playbook = { slug: string; title?: string; summary?: string } & Record<string, unknown>

/**
 * The playbook from the same repo GET /api/resources/playbooks/:slug reads.
 * A missing or unpublished slug is a 404 with a noindex head.
 */
export async function loader({ params, context }: Route.LoaderArgs) {
  const [playbook, site] = await Promise.all([
    context.repos.resources.findPublishedPlaybook(params.slug as never) as Promise<Playbook | null>,
    seoSite(),
  ])
  if (!playbook) throw await notFound(context, MAX_AGE, 'Playbook not found')
  return data(
    { playbook, seo: resourceItemMeta(site, SECTION, playbook) },
    { headers: { 'Cache-Control': cacheControl(context, MAX_AGE) } },
  )
}

export const meta = seoMeta
export const headers = cacheHeaders
