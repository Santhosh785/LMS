import { data } from 'react-router'
import type { Route } from './+types/skill-detail'
import { cacheControl, notFound, resourceItemMeta, seoSite } from '../../lib/pageSeo.server'
import { cacheHeaders, seoMeta } from '../../lib/pageSeo'

// The error boundary renders the page's own "Skill not found" copy for a 404.
export { default, ErrorBoundary } from '../../pages/public/SkillDetail.jsx'

export const handle = { bodyClass: 'gs-redesign' }

const SECTION = '/resources/claude-skills'
const MAX_AGE = 600

type Skill = { slug: string; title?: string; summary?: string } & Record<string, unknown>

/**
 * The skill from the same repo GET /api/resources/skills/:slug reads. A
 * missing or unpublished slug is a 404 with a noindex head.
 */
export async function loader({ params, context }: Route.LoaderArgs) {
  const [skill, site] = await Promise.all([
    context.repos.resources.findPublishedSkill(params.slug as never) as Promise<Skill | null>,
    seoSite(),
  ])
  if (!skill) throw await notFound(context, MAX_AGE, 'Skill not found')
  return data(
    { skill, seo: resourceItemMeta(site, SECTION, skill) },
    { headers: { 'Cache-Control': cacheControl(context, MAX_AGE) } },
  )
}

export const meta = seoMeta
export const headers = cacheHeaders
