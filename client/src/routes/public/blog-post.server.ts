import type { AppLoadContext } from 'react-router'
import { seoSite } from 'growth-scholar-server/src/services/seo.js'
import { publicCache } from 'growth-scholar-server/src/middleware/cacheControl.js'

/**
 * Server-only half of the blog post route: the database read, the `Site` the
 * SEO mappers take and the cache policy. The `.server` suffix keeps all of it
 * (and the server modules it imports) out of the browser bundle.
 */

export { seoSite, publicCache }

type Row = Record<string, unknown>

/** The admin-editable SEO fields on a post (the `seo` JSON column). */
export interface PostSeo {
  metaTitle?: string
  metaDescription?: string
  canonicalUrl?: string
  ogImage?: string
  noIndex?: boolean
}

/** What the article page renders — nothing else from the row is sent. */
export interface PostView {
  _id: string
  slug: string
  title: string
  excerpt: string | null
  category: string | null
  author: { name?: string } | null
  publishedAt: Date | string | null
  updatedAt: Date | string | null
  readTime: string | null
  image: string | null
  imageAlt: string | null
  imageSrcset: string | null
  imageWidth: number | null
  imageHeight: number | null
  heroClass: string | null
  heroLabel: string | null
  body: Row[]
  allowComments: boolean
  seo: PostSeo
}

/** A related-reading card. */
export interface RelatedPostView {
  _id: string
  slug: string
  title: string
  image: string | null
  imageAlt: string | null
  heroClass: string | null
  heroLabel: string | null
  publishedAt: Date | string | null
  readTime: string | null
}

type FindPublicPostPage = (slug: string) => Promise<{ post: Row; related: Row[] } | null>

const str = (value: unknown) => (typeof value === 'string' ? value : null)
const num = (value: unknown) => (typeof value === 'number' && value > 0 ? value : null)
const date = (value: unknown) => (value instanceof Date || typeof value === 'string' ? value : null)

function toAuthor(value: unknown): PostView['author'] {
  if (typeof value === 'string') return value.trim() ? { name: value.trim() } : null
  if (!value || typeof value !== 'object') return null
  const name = str((value as Row).name)
  return name ? { name } : {}
}

function toSeo(value: unknown): PostSeo {
  const seo = (value && typeof value === 'object' ? value : {}) as Row
  return {
    metaTitle: str(seo.metaTitle) ?? undefined,
    metaDescription: str(seo.metaDescription) ?? undefined,
    canonicalUrl: str(seo.canonicalUrl) ?? undefined,
    ogImage: str(seo.ogImage) ?? undefined,
    noIndex: seo.noIndex === true || seo.noIndex === 'true',
  }
}

function toPostView(post: Row): PostView {
  return {
    _id: String(post._id ?? post.id),
    slug: String(post.slug),
    title: String(post.title ?? ''),
    excerpt: str(post.excerpt),
    category: str(post.category),
    author: toAuthor(post.author),
    publishedAt: date(post.publishedAt),
    updatedAt: date(post.updatedAt),
    readTime: str(post.readTime),
    image: str(post.image),
    imageAlt: str(post.imageAlt),
    imageSrcset: str(post.imageSrcset),
    imageWidth: num(post.imageWidth),
    imageHeight: num(post.imageHeight),
    heroClass: str(post.heroClass),
    heroLabel: str(post.heroLabel),
    body: Array.isArray(post.body) ? (post.body as Row[]) : [],
    allowComments: post.allowComments === true,
    seo: toSeo(post.seo),
  }
}

function toRelatedView(post: Row): RelatedPostView {
  return {
    _id: String(post._id ?? post.id),
    slug: String(post.slug),
    title: String(post.title ?? ''),
    image: str(post.image),
    imageAlt: str(post.imageAlt),
    heroClass: str(post.heroClass),
    heroLabel: str(post.heroLabel),
    publishedAt: date(post.publishedAt),
    readTime: str(post.readTime),
  }
}

/**
 * The public post and its related posts through the load context's blog repo
 * (`findPublicPostPage`, which wraps `findPublicPostBySlug`), or null when the
 * slug has no public post — a draft, a private post and a post scheduled for
 * later are all indistinguishable from a slug that never existed.
 */
export async function loadPostPage(context: AppLoadContext, slug: string) {
  const find = context.repos.blog.findPublicPostPage as unknown as FindPublicPostPage
  const page = await find(slug)
  if (!page) return null
  return { post: toPostView(page.post), related: page.related.map(toRelatedView) }
}
