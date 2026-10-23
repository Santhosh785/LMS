/**
 * Types for the server modules lib/detailPage.server.ts re-exports. The server
 * workspace is plain JavaScript with no declarations of its own.
 */

declare module 'growth-scholar-server/src/middleware/cacheControl.js' {
  export function publicCache(seconds: number, hasUser: boolean): string
}

declare module 'growth-scholar-server/src/services/seo.js' {
  export function seoSite(): Promise<import('@gs/seo').Site>
}
