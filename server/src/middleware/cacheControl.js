/**
 * Cache-Control policy.
 *
 * `publicCache` is the header a server-rendered public page will carry once
 * the page tasks convert it to loader data: cacheable at the edge for
 * `seconds`, served stale for a day while it revalidates — unless the request
 * is for a signed-in visitor, whose page is personal and must not be stored
 * anywhere. Exported for those later tasks; nothing applies it yet.
 *
 * @param {number} seconds s-maxage for the shared cache
 * @param {boolean} hasUser whether the response is for a signed-in visitor
 * @returns {string}
 */
export function publicCache(seconds, hasUser) {
  if (hasUser) return 'private, no-store'
  return `public, s-maxage=${Math.max(0, Math.floor(Number(seconds) || 0))}, stale-while-revalidate=86400`
}

/**
 * Every `/api/*` response defaults to `no-store`: the API answers with
 * session-specific data, and a shared cache that held one learner's dashboard
 * for the next is the kind of bug that ends a business. A route that is safe
 * to cache sets its own header afterwards and wins (GET /api/config).
 */
export function apiNoStore(_req, res, next) {
  res.set('Cache-Control', 'no-store')
  next()
}
