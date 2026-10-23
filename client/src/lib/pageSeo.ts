import { isRouteErrorResponse, type HeadersArgs, type MetaDescriptor } from 'react-router'
import { toMetaDescriptors, type SeoMeta } from '@gs/seo'

/**
 * The `meta` and `headers` exports the server-rendered public pages share.
 * Their loaders (lib/pageSeo.server.ts) return `{ seo }` and set the page's
 * Cache-Control; a detail loader throws a 404 carrying the same `{ seo }`.
 */

type WithSeo = { seo?: SeoMeta } | undefined

/** The page's head: from its loader data, or from the 404 it threw. */
export function seoMeta({ data, error }: { data?: unknown; error?: unknown }): MetaDescriptor[] {
  const fromError = isRouteErrorResponse(error) ? (error.data as WithSeo)?.seo : undefined
  const seo = (data as WithSeo)?.seo ?? fromError
  return seo ? (toMetaDescriptors(seo) as MetaDescriptor[]) : []
}

/** Passes the loader's Cache-Control through to the document response. */
export function cacheHeaders({ loaderHeaders, errorHeaders }: HeadersArgs): HeadersInit {
  const value = (errorHeaders ?? loaderHeaders).get('Cache-Control')
  return value ? { 'Cache-Control': value } : {}
}
