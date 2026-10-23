/**
 * Server-only helpers for the public detail pages' loaders.
 *
 * Both come from the server workspace rather than being re-implemented here,
 * so the page loaders and Express share one cache policy and one `Site` (the
 * PUBLIC_URL origin, never the request's Host header). The `.server` suffix
 * keeps this module — and the server code behind it — out of the browser
 * bundle; the bare `growth-scholar-server` specifier is external in the SSR
 * build (see vite.config.js), so the loaders use the module instances Express
 * already initialised.
 */
export { publicCache } from 'growth-scholar-server/src/middleware/cacheControl.js'
export { seoSite } from 'growth-scholar-server/src/services/seo.js'
