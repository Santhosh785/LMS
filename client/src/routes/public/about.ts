import { staticPageLoader } from '../../lib/pageSeo.server'
import { cacheHeaders, seoMeta } from '../../lib/pageSeo'

export { default } from '../../pages/public/About.jsx'

export const handle = { bodyClass: 'gs-redesign' }

/** Server-rendered in full; the scroll reveal and the count-up start after hydration. */
export const loader = staticPageLoader('/about', 86400)

export const meta = seoMeta
export const headers = cacheHeaders
