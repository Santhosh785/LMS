/**
 * The server modules page loaders import directly (always from a `.server`
 * module, so they never reach the browser bundle). The server is plain
 * JavaScript with no emitted types, so their signatures are restated here.
 */

declare module 'growth-scholar-server/src/middleware/cacheControl.js' {
  export function publicCache(seconds: number, hasUser: boolean): string
}

declare module 'growth-scholar-server/src/services/seo.js' {
  /** The `Site` every @gs/seo mapper takes: brand from site config, origin from PUBLIC_URL. */
  export function seoSite(): Promise<import('@gs/seo').Site>
}
