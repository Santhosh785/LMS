import type { AppLoadContext } from 'react-router'
import type { Site } from '@gs/seo'
import { env } from 'growth-scholar-server/src/config/env.js'
import { publicCache } from 'growth-scholar-server/src/middleware/cacheControl.js'

/**
 * Server-only helpers for the public listing loaders (/workshops, /blog). The
 * `.server` suffix keeps React Router from ever bundling this for the browser.
 */

/** Rows come back document-shaped from the repos: camelCased columns plus `_id`. */
export type Doc = Record<string, unknown> & { _id: string; slug?: string; title?: string }

interface WorkshopsRepo {
  listWorkshops(opts: { mode?: string; language?: string }): Promise<Doc[]>
}

export interface BlogPage {
  items: Doc[]
  total: number
  page: number
  pages: number
  featured: Doc[]
  categories: string[]
}

interface BlogRepo {
  listPublicPosts(opts: {
    category?: string
    tag?: string
    q?: string
    page?: number
    limit?: number
  }): Promise<BlogPage>
}

/**
 * The repos the listings read, typed. The load context only knows them as
 * loose modules (types/load-context.d.ts); these are the signatures of
 * server/src/db/repos/workshops.js and blog.js.
 */
export const workshopsRepo = (context: AppLoadContext) =>
  context.repos.workshops as unknown as WorkshopsRepo
export const blogRepo = (context: AppLoadContext) => context.repos.blog as unknown as BlogRepo

/**
 * The @gs/seo `Site` for `meta()`: the brand from the site config this request
 * already carries (the same one the header renders with), the origin from
 * PUBLIC_URL — never from the request's Host header, which the client
 * controls. Mirrors `seoSite()` in server/src/services/seo.js.
 */
export function listingSite(context: AppLoadContext): Site {
  const branding = context.siteConfig?.branding
  return {
    url: env.siteUrl,
    brandName: branding?.brandName || 'Growth Scholar',
    logoUrl: branding?.logoUrl || '/logo.png',
  }
}

/**
 * The page's Cache-Control: five minutes at the edge for an anonymous visitor,
 * never stored for a signed-in one. The loader sets it and `headers()` passes
 * it on, because `headers()` itself never sees the request.
 */
export const listingCacheHeaders = (context: AppLoadContext) => ({
  'Cache-Control': publicCache(300, Boolean(context.user)),
})
