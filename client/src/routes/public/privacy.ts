import { businessFrom } from '../../data/legal.js'
import { staticPageLoader } from '../../lib/pageSeo.server'
import { cacheHeaders, seoMeta } from '../../lib/pageSeo'

export { default } from '../../pages/public/Privacy.jsx'

/**
 * Server-rendered. The business identity the policy text quotes is resolved
 * here from site config, so the first HTML already carries it.
 */
export const loader = staticPageLoader('/privacy', 86400, (context) => ({
  business: businessFrom(context.siteConfig),
}))

export const meta = seoMeta
export const headers = cacheHeaders
