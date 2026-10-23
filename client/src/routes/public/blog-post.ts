import { data, isRouteErrorResponse } from 'react-router'
import { noindexMeta, notFoundMeta, postMeta, toMetaDescriptors } from '@gs/seo'
import type { Site } from '@gs/seo'

import type { Route } from './+types/blog-post'
import { loadPostPage, publicCache, seoSite } from './blog-post.server'

/**
 * `/blog/:slug`, server-rendered: the article, its byline, breadcrumb, table of
 * contents and related posts are in the first HTML response, and the head comes
 * from `meta()` alone. Comments, likes and the forms stay client interactions
 * (see the page component).
 */
export { default, ErrorBoundary } from '../../pages/public/BlogPost.jsx'

/** A missing article is cached briefly: a scheduled post goes live on the clock, not on a purge. */
const NOT_FOUND_CACHE_SECONDS = 60

export async function loader({ params, context }: Route.LoaderArgs) {
  const hasUser = Boolean(context.user)
  const [page, site] = await Promise.all([loadPostPage(context, params.slug), seoSite()])
  if (!page) {
    // A 404 data response, never a redirect or a 200 with an error body. The
    // site rides along so meta() can title the not-found page.
    throw data(
      { site },
      {
        status: 404,
        headers: { 'Cache-Control': publicCache(NOT_FOUND_CACHE_SECONDS, hasUser) },
      },
    )
  }
  // The share links and the Ask-AI prompts are built from the configured site
  // origin, not from window.location, so the server and the browser agree.
  const shareUrl = `${site.url.replace(/\/+$/, '')}/blog/${encodeURIComponent(page.post.slug)}`
  return data(
    { ...page, site, shareUrl },
    { headers: { 'Cache-Control': publicCache(600, hasUser) } },
  )
}

export function headers({ loaderHeaders, errorHeaders }: Route.HeadersArgs) {
  return errorHeaders ?? loaderHeaders
}

/** The site for a failed render: the 404's own, else the brand from the root loader. */
function fallbackSite(error: unknown, matches: Route.MetaArgs['matches']): Site {
  if (isRouteErrorResponse(error)) {
    const site = (error.data as { site?: Site } | null)?.site
    if (site) return site
  }
  const root = matches.find((m) => m?.id === 'root')?.data as
    { siteConfig?: { branding?: { brandName?: string } } } | undefined
  return { url: '', brandName: root?.siteConfig?.branding?.brandName || 'Growth Scholar' }
}

/**
 * The whole head for the page: postMeta honours the post's own SEO fields and
 * falls back to its title, excerpt and cover image, and carries the
 * BlogPosting and BreadcrumbList JSON-LD. A 404 is noindex and titled as not
 * found; any other failure is noindex under the brand title.
 */
export const meta: Route.MetaFunction = ({ data: page, error, matches }) => {
  if (page) return toMetaDescriptors(postMeta(page.post, page.site))
  const site = fallbackSite(error, matches)
  const notFound = isRouteErrorResponse(error) && error.status === 404
  return toMetaDescriptors(notFound ? notFoundMeta(site) : noindexMeta(site))
}
