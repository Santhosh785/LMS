/**
 * Server modules a route loader imports by bare specifier. They resolve to the
 * server workspace, which ships no type declarations; `growth-scholar-server`
 * is external in the SSR build (vite.config.js), so a loader shares the
 * instances Express initialised. Import these only from `*.server.ts` modules,
 * so they can never be pulled into the browser bundle.
 */

declare module 'growth-scholar-server/src/services/seo.js' {
  /** The `Site` every @gs/seo mapper takes: the PUBLIC_URL origin plus the cached branding. */
  export function seoSite(): Promise<import('@gs/seo').Site>
}

declare module 'growth-scholar-server/src/middleware/cacheControl.js' {
  /** `public, s-maxage=…` for an anonymous visitor, `private, no-store` for a signed-in one. */
  export function publicCache(seconds: number, hasUser: boolean): string
}
