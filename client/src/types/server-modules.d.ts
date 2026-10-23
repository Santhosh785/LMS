/**
 * Server modules the listing loaders import directly. They run only on the
 * server (the SSR build keeps `growth-scholar-server` external, so these are
 * the very modules Express initialised) and are stripped from the client
 * bundle along with the loaders that use them.
 */

declare module 'growth-scholar-server/src/middleware/cacheControl.js' {
  export function publicCache(seconds: number, hasUser: boolean): string
}

declare module 'growth-scholar-server/src/config/env.js' {
  export const env: {
    /** PUBLIC_URL (or the server's own origin in development), no trailing slash. */
    siteUrl: string
  }
}
