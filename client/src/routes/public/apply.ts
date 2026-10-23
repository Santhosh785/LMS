import { staticPageLoader } from '../../lib/pageSeo.server'
import { cacheHeaders, seoMeta } from '../../lib/pageSeo'

export { default } from '../../pages/public/Apply.jsx'

export const handle = { bodyClass: 'gs-redesign pa-page' }

/** The form renders on the server; submitting stays a client-side POST to /api/applications. */
export const loader = staticPageLoader('/programs/apply', 3600)

export const meta = seoMeta
export const headers = cacheHeaders
