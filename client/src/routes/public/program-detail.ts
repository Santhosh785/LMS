import { data } from 'react-router'
import { programMeta, toMetaDescriptors, type ProgramInput } from '@gs/seo'

import type { Route } from './+types/program-detail'
import { publicCache, seoSite } from '../../lib/detailPage.server'

export { default } from '../../pages/public/ProgramDetail.jsx'

export const handle = { bodyClass: 'gs-redesign prog-page' }

/** The slice of server/src/db/repos/programs.js this loader calls. */
interface ProgramsRepo {
  findProgramBySlug(slug: string): Promise<(ProgramInput & Record<string, unknown>) | undefined>
}

/**
 * /programs/:slug, server-rendered. Programs have no status or visibility
 * column — every stored program is public — so the by-slug lookup is the
 * public lookup, the same one GET /api/programs/:slug and the SEO resolver
 * use. An unknown slug is a 404, rendered as the not-found page by the public
 * layout's error boundary.
 */
export async function loader({ params, context }: Route.LoaderArgs) {
  const repo = context.repos.programs as unknown as ProgramsRepo
  const found = await repo.findProgramBySlug(params.slug)
  if (!found) throw data(null, { status: 404 })

  const { legacyId: _legacy, ...program } = found

  return data(
    { program, site: await seoSite() },
    { headers: { 'Cache-Control': publicCache(600, Boolean(context.user)) } },
  )
}

export function headers({ loaderHeaders }: Route.HeadersArgs) {
  const cacheControl = loaderHeaders.get('Cache-Control')
  return cacheControl ? { 'Cache-Control': cacheControl } : new Headers()
}

/** Title, description, canonical, Open Graph and BreadcrumbList JSON-LD from `programMeta`. */
export const meta: Route.MetaFunction = ({ data: loaderData }) =>
  loaderData
    ? toMetaDescriptors(programMeta(loaderData.program, loaderData.site))
    : [{ title: 'Page not found' }, { name: 'robots', content: 'noindex, nofollow' }]
