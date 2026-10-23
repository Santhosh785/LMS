import { data, redirect, type AppLoadContext } from 'react-router'
import { absoluteUrl, notFoundMeta, staticMeta, type SeoMeta, type Site } from '@gs/seo'
import { publicCache } from 'growth-scholar-server/src/middleware/cacheControl.js'
import { seoSite } from 'growth-scholar-server/src/services/seo.js'

/**
 * Server-only loader helpers for the server-rendered public pages: the
 * `Site` the @gs/seo mappers take, and the Cache-Control policy each page
 * carries. Loaders put the header on their response; the route's `headers`
 * export (lib/pageSeo.ts) passes it through to the document.
 */

export const NO_STORE = 'private, no-store'

/** `publicCache(seconds, hasUser)` for a cacheable page, `private, no-store` for `null`. */
export function cacheControl(context: AppLoadContext, seconds: number | null): string {
  return seconds == null ? NO_STORE : publicCache(seconds, Boolean(context.user))
}

export { seoSite }

/**
 * A loader for a page whose head is its `staticMeta` entry. `extra` adds the
 * page's own loader data (the legal pages' business identity, a listing).
 *
 * @param path the staticMeta key, e.g. "/about"
 * @param seconds the shared-cache lifetime, or null for `private, no-store`
 */
export function staticPageLoader<T extends object = Record<never, never>>(
  path: string,
  seconds: number | null,
  extra?: (context: AppLoadContext) => T | Promise<T>,
) {
  return async ({ context }: { context: AppLoadContext }) => {
    const [site, more] = await Promise.all([seoSite(), extra ? extra(context) : ({} as T)])
    return data(
      { ...more, seo: staticMeta(path, site) },
      { headers: { 'Cache-Control': cacheControl(context, seconds) } },
    )
  }
}

/**
 * The login and signup loaders: a signed-in visitor has no use for either
 * form, so they go where a successful sign-in would send them — admins to the
 * admin area, everyone else to the student area.
 */
export function redirectSignedIn(context: AppLoadContext) {
  if (!context.user) return
  throw redirect(context.user.role === 'admin' ? '/admin' : '/student', {
    headers: { 'Cache-Control': NO_STORE },
  })
}

const DESCRIPTION_MAX = 160

/**
 * Head for one resource item (a playbook, a skill): the section's static
 * meta with the item's title and summary, and the item's own canonical.
 * There is no @gs/seo mapper for these records; the title and description
 * follow its `<page> | <brand>` and ~160-character rules.
 */
export function resourceItemMeta(
  site: Site,
  section: string,
  item: { slug: string; title?: string | null; summary?: string | null },
): SeoMeta {
  const base = staticMeta(section, site)
  const canonical = absoluteUrl(site, `${section}/${item.slug}`)
  const summary = String(item.summary || '')
    .replace(/\s+/g, ' ')
    .trim()
  return {
    ...base,
    title: item.title ? `${item.title} | ${site.brandName}` : base.title,
    description:
      summary.length > DESCRIPTION_MAX
        ? `${summary.slice(0, DESCRIPTION_MAX - 1)}…`
        : summary || base.description,
    canonical,
    og: { ...base.og, url: canonical, type: 'article' },
  }
}

/**
 * The 404 a detail loader throws for an unknown slug: noindex head, the
 * page's own not-found copy, and the same cache policy as a found item.
 */
export async function notFound(context: AppLoadContext, seconds: number | null, message: string) {
  return data(
    { seo: notFoundMeta(await seoSite()), message },
    { status: 404, headers: { 'Cache-Control': cacheControl(context, seconds) } },
  )
}
