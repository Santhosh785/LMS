import { absoluteUrl, itemList, staticMeta, toMetaDescriptors } from '@gs/seo'
import type { Site } from '@gs/seo'

/**
 * `meta()` for a public listing page (/workshops, /blog): the page's
 * `staticMeta` entry with the listing's own title, a canonical that carries
 * only the query it is given (callers pass the non-default filters and never
 * the search text), and an ItemList of the cards the page renders, in order.
 *
 * Runs on the server and in the browser, from loader data only.
 */
export function listingMeta({
  site,
  path,
  title,
  params,
  items,
}: {
  site: Site
  path: string
  /** Page part of the title: "Workshops" → "Workshops | Growth Scholar". */
  title: string
  /** Canonical query, in order; empty values are left out. */
  params: Array<[string, string | number | null | undefined]>
  items: Array<{ path: string; name?: string }>
}) {
  const base = staticMeta(path, site)
  const query = new URLSearchParams()
  for (const [key, value] of params) {
    if (value != null && value !== '') query.set(key, String(value))
  }
  const qs = query.toString()
  const canonical = absoluteUrl(site, qs ? `${path}?${qs}` : path)
  const brand = site.brandName || 'Growth Scholar'
  return toMetaDescriptors({
    ...base,
    title: `${title} | ${brand}`,
    canonical,
    og: { ...base.og, url: canonical },
    jsonLd: [
      ...base.jsonLd,
      itemList(items.map((item) => ({ url: absoluteUrl(site, item.path), name: item.name }))),
    ],
  })
}
