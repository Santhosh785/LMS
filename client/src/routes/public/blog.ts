import { data } from 'react-router'
import type { Route } from './+types/blog'
import { blogRepo, listingCacheHeaders, listingSite } from '../../lib/listing.server'
import { listingMeta } from '../../lib/listingMeta'
import { BLOG_PAGE_SIZE, blogCategory, blogPage } from '../../lib/blogParams.js'

export { default } from '../../pages/public/Blog.jsx'

export const handle = { bodyClass: 'gs-redesign' }

/**
 * /blog[?category=&q=&page=]: one page of public posts plus the featured
 * spotlight, from the same repo query GET /api/blog runs — Draft, Private and
 * not-yet-due posts never reach this data. A malformed page is page 1; a page
 * past the end is the last page.
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const params = new URL(request.url).searchParams
  const category = blogCategory(params.get('category'))
  const q = (params.get('q') || '').trim()
  const query = { category: category || 'latest', q, limit: BLOG_PAGE_SIZE }
  const repo = blogRepo(context)
  const first = await repo.listPublicPosts({ ...query, page: blogPage(params.get('page')) })
  const result =
    first.page > first.pages ? await repo.listPublicPosts({ ...query, page: first.pages }) : first
  return data(
    {
      category,
      q,
      page: result.page,
      pages: result.pages,
      items: result.items,
      featured: result.featured,
      site: listingSite(context),
    },
    { headers: listingCacheHeaders(context) },
  )
}

export const headers: Route.HeadersFunction = ({ loaderHeaders }) => ({
  'Cache-Control': loaderHeaders.get('Cache-Control') ?? 'private, no-store',
})

/** The canonical keeps a non-default category and page, never the search text. */
export const meta: Route.MetaFunction = ({ data: page }) => {
  if (!page) return [{ title: 'Blog | Growth Scholar' }]
  return listingMeta({
    site: page.site,
    path: '/blog',
    title: 'Blog',
    params: [
      ['category', page.category || null],
      ['page', page.page > 1 ? page.page : null],
    ],
    items: page.items.map((p) => ({
      path: `/blog/${encodeURIComponent(String(p.slug))}`,
      name: p.title,
    })),
  })
}
