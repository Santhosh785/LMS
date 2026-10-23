import type { Route } from './+types/signup'
import { redirectSignedIn, staticPageLoader } from '../../lib/pageSeo.server'
import { cacheHeaders, seoMeta } from '../../lib/pageSeo'

export { default } from '../../pages/public/Signup.jsx'

/**
 * The form renders on the server with no user data; submitting stays
 * client-side through the auth context. A signed-in visitor is redirected
 * before anything renders. Never cached.
 */
export async function loader({ context }: Route.LoaderArgs) {
  redirectSignedIn(context)
  return staticPageLoader('/signup', null)({ context })
}

export const meta = seoMeta
export const headers = cacheHeaders
