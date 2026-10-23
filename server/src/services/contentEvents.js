import { dispatch } from '../jobs/dispatch.js'
// Imported for their defineJob side effect, so the jobs exist wherever an event can fire.
import '../jobs/sitemap.js'
import '../jobs/cloudflare.js'

/**
 * Content-change events. Every admin write that changes a public page calls
 * `contentChanged`, and it fans out to two background jobs (docs/jobs.md):
 *
 *   regenerate-sitemap       drop the sitemap memo on every instance and rebuild it
 *   purge-cloudflare-cache   purge the affected pages from the Cloudflare edge
 *
 * It never fails the admin request: the write has already succeeded, and both
 * jobs are a cache refresh. With the queue running it resolves once both jobs
 * are stored (an enqueue failure is alerted and swallowed); inline — tests,
 * BOSS_ENABLED=0 — the handlers run in the background and are not awaited, so a
 * sitemap rebuild or a failing purge never holds up or fails the response. See
 * jobs/dispatch.js.
 */

export const CONTENT_KINDS = Object.freeze([
  'course',
  'program',
  'workshop',
  'post',
  'settings',
  'taxonomy',
])

/** The public paths a slugged item appears on, besides its own page. */
const PAGES = {
  course: (slug) => ['/', '/courses', `/courses/${slug}`],
  program: (slug) => ['/', `/programs/${slug}`],
  workshop: (slug) => ['/', '/workshops', `/workshops/${slug}`],
  post: (slug) => ['/', '/blog', `/blog/${slug}`],
}

/**
 * The purge payload for a change: `{ urls }` of site-relative paths, or
 * `{ everything: true }` for settings and taxonomy — the header and footer are
 * on every page. Throws on an unknown kind, or a slugged kind with no slug.
 *
 * Slugs are encoded the way the sitemap writes them, so the purged URL is the
 * one browsers (and so the edge cache) actually request.
 */
export function purgeTargetsFor(kind, slugs) {
  if (!CONTENT_KINDS.includes(kind)) throw new Error(`contentChanged: unknown kind "${kind}"`)
  if (kind === 'settings' || kind === 'taxonomy') return { everything: true }

  const list = (Array.isArray(slugs) ? slugs : [slugs]).filter(
    (s) => typeof s === 'string' && s.trim(),
  )
  if (!list.length) throw new Error(`contentChanged: a slug is required for kind "${kind}"`)
  const urls = new Set()
  for (const slug of list) {
    for (const path of PAGES[kind](encodeURIComponent(slug.trim()))) urls.add(path)
  }
  urls.add('/sitemap.xml')
  return { urls: [...urls] }
}

/**
 * Announces a change to public content. `slug` is required for course,
 * program, workshop and post. `slugs` takes several at once — a renamed item's
 * old and new slug, or a bulk action — and still queues one job of each kind.
 *
 * Validation throws synchronously (an unknown kind is a programming error);
 * the returned promise never rejects.
 */
export function contentChanged({ kind, slug, slugs } = {}) {
  const target = purgeTargetsFor(kind, slugs ?? slug)
  return Promise.all([
    dispatch('regenerate-sitemap', {}),
    dispatch('purge-cloudflare-cache', target),
  ]).then(() => undefined)
}

/**
 * `contentChanged` for call sites that must not throw at all: a validation
 * error is logged instead. For hooks that hand over whatever row they have.
 */
export async function safeContentChanged(event) {
  try {
    await contentChanged(event)
  } catch (err) {
    console.error(`[content] change event not sent: ${err?.message}`)
  }
}
