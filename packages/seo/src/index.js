/**
 * @gs/seo — page meta for the Growth Scholar site.
 *
 * Plain objects in, plain objects/strings out. No database, no Express, no
 * URL routing and no Node-only APIs: the same module runs in React Router
 * `meta()` on the client and on the server.
 */

export {
  courseMeta,
  programMeta,
  workshopMeta,
  postMeta,
  termMeta,
  staticMeta,
  noindexMeta,
  notFoundMeta,
  STATIC_PATHS,
} from './mappers.js'

export {
  organization,
  webSite,
  course,
  blogPosting,
  event,
  breadcrumbList,
  itemList,
} from './jsonld.js'

export { absoluteUrl, escapeHtml } from './format.js'

export { jsonLdScript, toHeadHtml, toMetaDescriptors } from './render.js'

/** @typedef {import('./types.js').Site} Site */
/** @typedef {import('./types.js').SeoMeta} SeoMeta */
/** @typedef {import('./types.js').SeoOpenGraph} SeoOpenGraph */
/** @typedef {import('./types.js').BreadcrumbItem} BreadcrumbItem */
