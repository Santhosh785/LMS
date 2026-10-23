/*
 * The server modules the catalogue loaders (lib/courseListing.server.ts)
 * import directly. The server is plain JavaScript with no exported types, so
 * the signatures are declared here from the source. No top-level import: this
 * file must stay a global declaration, not a module augmentation.
 */

declare module 'growth-scholar-server/src/middleware/cacheControl.js' {
  export function publicCache(seconds: number, hasUser: boolean): string
}

declare module 'growth-scholar-server/src/services/seo.js' {
  export function seoSite(): Promise<import('@gs/seo').Site>
}

declare module 'growth-scholar-server/src/services/taxonomy.js' {
  /** A visible (Published, Public) term by exact name, with its `seo` JSON, or null. */
  export function findPublicTermByName(
    taxonomy: string,
    name: string,
  ): Promise<import('@gs/seo').TermInput | null>
}
