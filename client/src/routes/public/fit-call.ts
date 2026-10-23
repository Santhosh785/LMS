import { staticPageLoader } from '../../lib/pageSeo.server'
import { cacheHeaders, seoMeta } from '../../lib/pageSeo'

export { default } from '../../pages/public/FitCall.jsx'

export const handle = { bodyClass: 'gs-redesign pa-page pa-page--fit' }

/** The form renders on the server; submitting stays a client-side POST to /api/fit-calls. */
export const loader = staticPageLoader('/programs/fit-call', 3600)

export const meta = seoMeta
export const headers = cacheHeaders
