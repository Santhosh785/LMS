import { data } from 'react-router'
import { courseMeta, toMetaDescriptors, type CourseInput } from '@gs/seo'

import type { Route } from './+types/course-detail'
import { publicCache, seoSite } from '../../lib/detailPage.server'

export { default } from '../../pages/public/CourseDetail.jsx'

export const handle = { bodyClass: 'gs-redesign course-page--convert' }

/** The slice of server/src/db/repos/courses.js this loader calls. */
interface CoursesRepo {
  findPublicBySlug(slug: string): Promise<(CourseInput & Record<string, unknown>) | null>
}

/**
 * /courses/:slug, server-rendered. `findPublicBySlug` is the one definition of
 * "public" (Published and Public) and already strips every video URL and Bunny
 * id from the curriculum, so nothing a player could use reaches the HTML —
 * preview playback still asks GET /api/courses/:slug/preview/:lessonId when the
 * visitor presses play. An unknown slug and a Draft or Hidden one are the same
 * 404, rendered by the public layout's error boundary as the not-found page.
 *
 * Personal state (the visitor's enrollment) stays a client-side query, so the
 * HTML is the same for everyone and is shared-cacheable unless the request is
 * signed in.
 */
export async function loader({ params, context }: Route.LoaderArgs) {
  const repo = context.repos.courses as unknown as CoursesRepo
  const found = await repo.findPublicBySlug(params.slug)
  if (!found) throw data(null, { status: 404 })

  // Admin-only configuration the page never reads stays off the wire.
  const { dripSchedule: _drip, automationRules: _rules, legacyId: _legacy, ...course } = found

  return data(
    { course, site: await seoSite() },
    { headers: { 'Cache-Control': publicCache(600, Boolean(context.user)) } },
  )
}

export function headers({ loaderHeaders }: Route.HeadersArgs) {
  const cacheControl = loaderHeaders.get('Cache-Control')
  return cacheControl ? { 'Cache-Control': cacheControl } : new Headers()
}

/**
 * Title, description, canonical, Open Graph, and the Course and BreadcrumbList
 * JSON-LD, all from `courseMeta`. A 404 never reaches this function — the
 * error renders in the layout's boundary and the root's not-found meta
 * (noindex) applies — but a missing `data` still degrades to noindex.
 */
export const meta: Route.MetaFunction = ({ data: loaderData }) =>
  loaderData
    ? toMetaDescriptors(courseMeta(loaderData.course, loaderData.site))
    : [{ title: 'Page not found' }, { name: 'robots', content: 'noindex, nofollow' }]
