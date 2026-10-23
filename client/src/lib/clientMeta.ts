import type { MetaDescriptor } from 'react-router'

/**
 * The `meta` export for a client-only route (admin, student, community,
 * checkout). These pages are never indexed — the root loader marks the same
 * prefixes noindex (server/src/services/seo.js) — and a route `meta` replaces
 * the root's rather than merging with it, so the robots tag is restated here.
 *
 * The title is fixed per route: it is rendered into the document by the server
 * and updated on client navigation like any other route title.
 */
export function privateMeta(title: string) {
  return (): MetaDescriptor[] => [{ title }, { name: 'robots', content: 'noindex, nofollow' }]
}
