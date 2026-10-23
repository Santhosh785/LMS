import { invalidateEverywhere } from '../services/invalidation.js'
import { defineJob, schedule } from '../services/queue.js'
import { getSitemap } from '../services/sitemap.js'

/**
 * Job `regenerate-sitemap` — no data.
 *
 * Queued by every content change (services/contentEvents.js) and on a cron
 * every six hours as a backstop. Drops the sitemap memo on every instance — the
 * `sitemap` scope on the invalidation channel (services/invalidation.js) — and
 * then builds it once here, so the next crawler hit on this instance is served
 * from memory. The other instances rebuild on their next request.
 *
 * Idempotent: running it twice costs one extra build.
 */
export async function regenerateSitemap(
  _data,
  { invalidate = () => invalidateEverywhere('sitemap'), warm = getSitemap } = {},
) {
  await invalidate()
  const xml = await warm()
  return { bytes: xml.length }
}

export const SITEMAP_CRON = '0 */6 * * *'

defineJob('regenerate-sitemap', {
  handler: (data) => regenerateSitemap(data),
  /*
   * `stately`: at most one job queued (or waiting on a retry) and one running.
   * A burst of admin saves collapses into one rebuild; a save that lands while
   * a rebuild is running still gets one after it, so no change is missed.
   */
  queueOptions: { policy: 'stately' },
})

/** Registers the six-hourly backstop. Call after startQueue(); inline it is a no-op. */
export const scheduleSitemapRegeneration = () => schedule('regenerate-sitemap', SITEMAP_CRON)
