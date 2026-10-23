import { toMetaDescriptors } from '@gs/seo'

import type { Route } from './+types/courses'
import { loadExplore, pickCacheHeaders } from '../../lib/courseListing.server'

export { default } from '../../pages/public/Courses.jsx'

export const handle = { bodyClass: 'gs-redesign explore-page--convert' }

/** The first page of cards, the total, the facets and the selection — see Courses.jsx. */
export function loader({ request, context }: Route.LoaderArgs) {
  return loadExplore(request, context)
}

export const headers: Route.HeadersFunction = pickCacheHeaders

export const meta: Route.MetaFunction = ({ data }) => (data ? toMetaDescriptors(data.seo) : [])
