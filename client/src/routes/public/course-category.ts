import { createElement } from 'react'
import { toMetaDescriptors } from '@gs/seo'

import RouteErrorView from '../../components/RouteErrorView'

import type { Route } from './+types/course-category'
import { loadCategory, pickCacheHeaders } from '../../lib/courseListing.server'

export { default } from '../../pages/public/CourseCategory.jsx'

export const handle = { bodyClass: 'gs-redesign cat-page--convert' }

/** The topic's courses (or all of them), the facets and the selection — see CourseCategory.jsx. */
export function loader({ request, context }: Route.LoaderArgs) {
  return loadCategory(request, context)
}

export const headers: Route.HeadersFunction = pickCacheHeaders

/**
 * An unknown topic is a 404 rendered by this route's own boundary — the same
 * RouteErrorView the public layout uses, inside the layout's chrome — so that
 * this meta (not the root's catalogue meta) and the 404's cache headers apply.
 */
export function ErrorBoundary() {
  return createElement(RouteErrorView, { scope: 'route' })
}

export const meta: Route.MetaFunction = ({ data, matches }) => {
  if (data) return toMetaDescriptors(data.seo)
  const root = matches.find((m) => m?.id === 'root')?.data as
    { siteConfig?: { branding?: { brandName?: string } } } | undefined
  const brand = root?.siteConfig?.branding?.brandName || 'Growth Scholar'
  return [{ title: `Page not found | ${brand}` }, { name: 'robots', content: 'noindex, nofollow' }]
}
