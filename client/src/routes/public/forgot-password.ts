import { staticPageLoader } from '../../lib/pageSeo.server'
import { cacheHeaders, seoMeta } from '../../lib/pageSeo'

export { default } from '../../pages/public/ForgotPassword.jsx'

/** The form renders on the server; submitting stays client-side. Never cached. */
export const loader = staticPageLoader('/forgot-password', null)

export const meta = seoMeta
export const headers = cacheHeaders
