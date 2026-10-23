import type { Route } from './+types/login'
import { redirectSignedIn, staticPageLoader } from '../../lib/pageSeo.server'
import { cacheHeaders, seoMeta } from '../../lib/pageSeo'

export { default } from '../../pages/public/Login.jsx'

/**
 * The form renders on the server with no user data; submitting stays
 * client-side through the auth context (which honours the "return to" page
 * a protected route sent the visitor from). A signed-in visitor is redirected
 * before anything renders. Never cached.
 */
export async function loader({ context }: Route.LoaderArgs) {
  redirectSignedIn(context)
  return staticPageLoader('/login', null)({ context })
}

export const meta = seoMeta
export const headers = cacheHeaders
