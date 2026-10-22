import { Setting } from '../models/index.js'
import { publicTermGroups } from './taxonomy.js'
import { cfg } from './runtimeConfig.js'

/**
 * The runtime configuration the browser needs before it can render anything.
 *
 * Until now this was three feature booleans, and the twenty fields an operator
 * could edit under /admin/settings were written to a document that nothing ever
 * read — the public site rendered a hardcoded brand name, logo and menu. This
 * assembles the settings singleton and the visible taxonomy into the single
 * payload the client reads at boot, so editing a setting changes the site.
 *
 * It is served on every cold page load, so it is cached in process and
 * invalidated explicitly on write rather than re-queried per request.
 */

/*
 * The in-flight promise is cached rather than its result, so N visitors
 * arriving together on a cold cache share one pair of queries instead of
 * running them N times.
 */
let cached = null
let cachedAt = 0

/** A safety net for multi-process deploys, where invalidate() only clears one. */
const TTL_MS = 60_000

export function invalidateSiteConfig() {
  cached = null
  cachedAt = 0
}

/** Only the fields the public site is allowed to see — never domain.verified. */
function publicSettings(setting) {
  const branding = setting.branding || {}
  const menu = setting.menu || {}
  const help = setting.help || {}
  return {
    branding: {
      brandName: branding.brandName || 'Growth Scholar',
      productName: branding.productName || 'Growth Scholar Learn',
      logoUrl: branding.logoUrl || '/logo.png',
      faviconUrl: branding.faviconUrl || '/logo.png',
      accentColor: branding.accentColor || '#3ecf8e',
    },
    menu: {
      showWorkshops: menu.showWorkshops !== false,
      showCourses: menu.showCourses !== false,
      showCommunity: menu.showCommunity !== false,
      showBlog: menu.showBlog !== false,
      showPractice: menu.showPractice !== false,
    },
    help: {
      supportEmail: help.supportEmail || '',
      salesEmail: help.salesEmail || '',
      helpCenterUrl: help.helpCenterUrl || '',
      hours: help.hours || '',
    },
  }
}

async function build() {
  const [setting, taxonomy] = await Promise.all([Setting.getSingleton(), publicTermGroups()])
  return { features: cfg.features, ...publicSettings(setting), taxonomy }
}

export function getSiteConfig() {
  const now = Date.now()
  if (cached && now - cachedAt < TTL_MS) return cached

  cachedAt = now
  cached = build().catch((err) => {
    // A failed build must not stick around for the whole TTL, or one blip
    // leaves every visitor without branding for a minute.
    invalidateSiteConfig()
    throw err
  })
  return cached
}
