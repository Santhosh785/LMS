import { staticPageLoader } from '../../lib/pageSeo.server'
import { cacheHeaders, seoMeta } from '../../lib/pageSeo'

export { default } from '../../pages/public/ResetPassword.jsx'

/** Only the form shell renders on the server: the token is checked against
 * the API after hydration, never here, so nothing about the account is in
 * the HTML. Never cached. */
export const loader = staticPageLoader('/reset-password', null)

export const meta = seoMeta
export const headers = cacheHeaders
