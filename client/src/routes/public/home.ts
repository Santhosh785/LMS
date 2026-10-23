import { data } from 'react-router'
import { organization, staticMeta, toMetaDescriptors, webSite, type Site } from '@gs/seo'
import { publicCache } from 'growth-scholar-server/src/middleware/cacheControl.js'

import type { Route } from './+types/home'
import type { SeoData, SiteConfig } from '../../types/load-context'

export { default } from '../../pages/public/Home.jsx'

export const handle = { bodyClass: 'gs-redesign home-lm' }

/** The self-paced grid: the six most popular courses, paid and free alike. */
const COURSE_GRID_SIZE = 6
/** The home page previews three workshops; the full list is one click away. */
const WORKSHOP_PREVIEW = 3
/** Seconds the shared cache may hold the logged-out page. */
const CACHE_SECONDS = 300

/** What a home course card renders, and nothing else. */
export interface HomeCourse {
  slug: string
  title: string
  topic: string | null
  kind: string | null
  price: 'paid' | 'free'
  durationLabel: string | null
  hours: number
  image: string | null
  thumbClass: string | null
  tag: string | null
  rating: number
}

/** What a home workshop card renders, and nothing else. */
export interface HomeWorkshop {
  slug: string
  title: string
  language: string | null
  mode: 'online' | 'offline'
  venue: string | null
  durationLabel: string | null
  image: string | null
  bannerClass: string | null
  priceNew: number
}

type CourseRow = Omit<HomeCourse, 'tag'> & { tags?: string[] | null }

/**
 * The load context types every repo function loosely; these are the two this
 * route calls, as server/src/db/repos/courses.js and workshops.js define them.
 */
interface HomeRepos {
  courses: {
    listPublic(params: { price: string; limit: number; sort: string }): Promise<{
      items: CourseRow[]
    }>
  }
  workshops: { listWorkshopCards(limit: number): Promise<HomeWorkshop[]> }
}

const toCourseCard = (c: CourseRow): HomeCourse => ({
  slug: c.slug,
  title: c.title,
  topic: c.topic ?? null,
  kind: c.kind ?? null,
  price: c.price,
  durationLabel: c.durationLabel ?? null,
  hours: c.hours,
  image: c.image ?? null,
  thumbClass: c.thumbClass ?? null,
  tag: c.tags?.[0] ?? null,
  rating: c.rating,
})

/**
 * The two card grids, read through the repos in-process and in parallel: the
 * same selection GET /api/courses and GET /api/workshops gave the page, cut
 * down to the fields the cards use. Nothing here depends on who is asking —
 * the signed-in user only decides whether the response may be cached.
 */
export async function loader({ context }: Route.LoaderArgs) {
  const repos = context.repos as unknown as HomeRepos
  const [courseList, workshops] = await Promise.all([
    repos.courses.listPublic({ price: 'paid,free', limit: COURSE_GRID_SIZE, sort: 'popularity' }),
    repos.workshops.listWorkshopCards(WORKSHOP_PREVIEW),
  ])
  return data(
    { courses: courseList.items.map(toCourseCard), workshops },
    { headers: { 'Cache-Control': publicCache(CACHE_SECONDS, Boolean(context.user)) } },
  )
}

/** The loader's `publicCache(300, hasUser)`: shared-cacheable only when logged out. */
export function headers({ loaderHeaders }: Route.HeadersArgs) {
  return { 'Cache-Control': loaderHeaders.get('Cache-Control') || publicCache(CACHE_SECONDS, true) }
}

/** The page title the home page has always carried, after the brand. */
const PAGE_TITLE = 'Become a Growth Marketer'

/**
 * The static home meta from `@gs/seo` with Organization and WebSite JSON-LD.
 * Brand and logo come from the site config the root loader carries (the load
 * context's `siteConfig`). That config has no origin, so the site URL is the
 * root's resolved canonical for `/` — PUBLIC_URL on the server, never the
 * request's Host. Without it (the resolver failed) the page still gets its
 * title and description, just no canonical or JSON-LD that would point at a
 * relative URL.
 */
export const meta: Route.MetaFunction = ({ matches }) => {
  const root = matches.find((m) => m?.id === 'root')?.data as
    { siteConfig?: SiteConfig; seo?: SeoData | null } | undefined
  const branding = root?.siteConfig?.branding
  const brandName = branding?.brandName || 'Growth Scholar'
  const title = `${brandName} — ${PAGE_TITLE}`
  const url = root?.seo?.canonical || ''
  const site: Site = { url, brandName, logoUrl: branding?.logoUrl || '/logo.png' }
  const home = staticMeta('/', site)

  if (!url) {
    return [{ title }, { name: 'description', content: home.description }]
  }
  return toMetaDescriptors({
    ...home,
    title,
    jsonLd: [organization(site), webSite(site)],
  })
}
