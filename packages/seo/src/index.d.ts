// Type declarations for @gs/seo. Mirrors the JSDoc in ./types.js and the
// signatures in ./mappers.js, ./jsonld.js, ./format.js and ./render.js.

export interface Site {
  /** Public origin, e.g. "https://growthscholar.in" (a trailing slash is fine). */
  url: string
  /** Appended to every title as " | <brandName>". */
  brandName: string
  /** Absolute or site-relative; the og:image fallback. */
  logoUrl?: string
  /** Used when a page has no description of its own. */
  defaultDescription?: string
}

export interface SeoOpenGraph {
  type: 'website' | 'article' | (string & {})
  /** Same as the canonical. */
  url: string
  /** Absolute URL; falls back to the site logo ('' when neither exists). */
  image: string
  siteName: string
}

export interface SeoMeta {
  title: string
  description: string
  /** Absolute URL; '' for noindex/404 results, where no canonical is emitted. */
  canonical: string
  robots: 'index, follow' | 'noindex, follow' | 'noindex, nofollow' | (string & {})
  og: SeoOpenGraph
  twitterCard: 'summary' | 'summary_large_image'
  /** Schema.org objects, one <script type="application/ld+json"> each. */
  jsonLd: object[]
  /** HTTP status the page should be served with (e.g. 404). */
  status?: number
}

export interface BreadcrumbItem {
  name: string
  url?: string
}

/** DB rows arrive camelCased with loosely typed columns; every field is optional. */
type Row = Record<string, any>

export interface CourseInput extends Row {
  title?: string
  slug?: string
  summary?: string | null
  image?: string | null
  imageAlt?: string | null
  /** Postgres numeric: number or numeric string. */
  amount?: number | string | null
  strikeAmount?: number | string | null
  hours?: number | string | null
  rating?: number | string | null
  /** Optional; aggregateRating is emitted only when one of these is > 0. */
  ratingCount?: number | string | null
  reviewCount?: number | string | null
  enrolledCount?: number | null
  categories?: string[]
  /** 'paid' | 'free' */
  price?: string | null
  /** 'Published' | 'Draft' — anything but Published is noindex. */
  status?: string | null
  /** 'Public' | 'Hidden' — anything but Public is noindex. */
  visibility?: string | null
}

export interface ProgramInput extends Row {
  title?: string
  slug?: string
  description?: string | null
  eyebrow?: string | null
  heroImage?: string | null
  weeks?: number | string | null
  pricing?: unknown
}

export interface WorkshopInput extends Row {
  title?: string
  slug?: string
  mode?: 'online' | 'offline' | (string & {}) | null
  venue?: string | null
  image?: string | null
  priceNew?: number | string | null
  startsAt?: string | Date | null
  durationLabel?: string | null
  host?: string | null
  level?: string | null
}

export interface SeoOverrides {
  metaTitle?: string
  metaDescription?: string
  canonicalUrl?: string
  ogImage?: string
  noIndex?: boolean
}

export interface PostInput extends Row {
  title?: string
  slug?: string
  excerpt?: string | null
  image?: string | null
  author?: { name?: string } | string | null
  publishedAt?: string | Date | null
  updatedAt?: string | Date | null
  category?: string | null
  seo?: SeoOverrides | string | null
}

export interface TermInput extends Row {
  name?: string
  slug?: string
  description?: string | null
  seo?: SeoOverrides | string | null
}

export type MetaDescriptor =
  | { title: string }
  | { name: string; content: string }
  | { property: string; content: string }
  | { tagName: 'link'; rel: 'canonical'; href: string }
  | { 'script:ld+json': object }

// Mappers
export function courseMeta(course: CourseInput, site: Site): SeoMeta
export function programMeta(program: ProgramInput, site: Site): SeoMeta
export function workshopMeta(workshop: WorkshopInput, site: Site): SeoMeta
export function postMeta(post: PostInput, site: Site): SeoMeta
export function termMeta(term: TermInput, site: Site): SeoMeta
export function staticMeta(path: string, site: Site): SeoMeta
export function noindexMeta(site: Site): SeoMeta
export function notFoundMeta(site: Site): SeoMeta
/** The 18 paths staticMeta has entries for. */
export const STATIC_PATHS: readonly string[]

// JSON-LD builders
export function organization(site: Site): Record<string, any>
export function webSite(site: Site): Record<string, any>
export function course(course: CourseInput, site: Site): Record<string, any>
export function blogPosting(post: PostInput, site: Site): Record<string, any>
export function event(workshop: WorkshopInput, site: Site): Record<string, any>
export function breadcrumbList(items: BreadcrumbItem[]): Record<string, any>
export function itemList(urls: string[]): Record<string, any>

// Helpers
export function absoluteUrl(site: Site, pathOrUrl: string | null | undefined): string
export function escapeHtml(str: unknown): string
export function jsonLdScript(obj: unknown): string
export function toHeadHtml(meta: SeoMeta): string
export function toMetaDescriptors(meta: SeoMeta): MetaDescriptor[]
