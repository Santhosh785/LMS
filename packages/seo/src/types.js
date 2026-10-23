/**
 * Shared type definitions (JSDoc). The same shapes are declared for
 * TypeScript consumers in ./index.d.ts — keep the two in step.
 *
 * @typedef {object} Site
 * @property {string} url                 Public origin, e.g. "https://growthscholar.in" (a trailing slash is fine).
 * @property {string} brandName           Appended to every title as " | <brandName>".
 * @property {string} [logoUrl]           Absolute or site-relative; the og:image fallback.
 * @property {string} [defaultDescription] Used when a page has no description of its own.
 *
 * @typedef {object} SeoOpenGraph
 * @property {string} type      "website" | "article"
 * @property {string} url       Same as the canonical.
 * @property {string} image     Absolute URL; falls back to the site logo ('' when neither exists).
 * @property {string} siteName  site.brandName
 *
 * @typedef {object} SeoMeta
 * @property {string} title
 * @property {string} description
 * @property {string} canonical   Absolute URL; '' for noindex/404 results, where no canonical is emitted.
 * @property {string} robots      "index, follow" | "noindex, follow" | "noindex, nofollow"
 * @property {SeoOpenGraph} og
 * @property {'summary' | 'summary_large_image'} twitterCard
 * @property {object[]} jsonLd    Schema.org objects, one <script type="application/ld+json"> each.
 * @property {number} [status]    HTTP status the page should be served with (e.g. 404).
 *
 * @typedef {{ name: string, url?: string }} BreadcrumbItem
 */

export {}
