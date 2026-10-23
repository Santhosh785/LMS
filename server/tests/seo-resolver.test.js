import { describe, expect, it } from 'vitest'
import { env } from '../src/config/env.js'
import { blogPosts, terms } from '../src/db/schema/index.js'
import { createCourse } from '../src/db/repos/courses.js'
import { updateSettings } from '../src/db/repos/settings.js'
import { resolveSeo, SEO_ROUTE_PATTERNS } from '../src/services/seo.js'
import { invalidateSiteConfig } from '../src/services/siteConfig.js'
import { insertRow } from './helpers/content.js'

/**
 * The URL-to-meta resolver (services/seo.js). The React Router root loader
 * calls it through the load context for every document request, so a crawler
 * gets one answer per URL, and its `status` becomes the document's status.
 */

const course = (slug, over = {}) =>
  createCourse({
    title: `Course ${slug}`,
    slug,
    summary: `What ${slug} teaches.`,
    price: 'paid',
    amount: 4999,
    status: 'Published',
    visibility: 'Public',
    ...over,
  })

describe('resolveSeo', () => {
  it('tries the routes in the specified order', () => {
    const at = (p) => SEO_ROUTE_PATTERNS.indexOf(p)
    expect(at('/courses/category')).toBeLessThan(at('/courses/:slug'))
    expect(at('/programs/apply')).toBeLessThan(at('/programs/:slug'))
    expect(at('/programs/fit-call')).toBeLessThan(at('/programs/:slug'))
    expect(SEO_ROUTE_PATTERNS[0]).toBe('/')
  })

  it('resolves /courses/category?topic= to the topic term, with its seo JSON', async () => {
    await insertRow(terms, {
      taxonomy: 'topic',
      name: 'Performance Marketing',
      slug: 'performance-marketing',
      seo: { metaTitle: 'Performance Marketing Courses in Tamil', metaDescription: 'Paid ads.' },
    })
    const meta = await resolveSeo(
      '/courses/category',
      new URLSearchParams('topic=Performance Marketing'),
    )
    expect(meta.status).toBeUndefined()
    expect(meta.title).toMatch(/^Performance Marketing Courses in Tamil \| /)
    expect(meta.description).toBe('Paid ads.')
    expect(meta.canonical).toBe(`${env.siteUrl}/courses/category?topic=Performance%20Marketing`)
  })

  it('falls back to the catalogue meta for a missing, unknown or hidden topic', async () => {
    await insertRow(terms, {
      taxonomy: 'topic',
      name: 'Hidden Topic',
      slug: 'hidden-topic',
      visibility: 'Hidden',
    })
    const catalogue = await resolveSeo('/courses')
    for (const query of ['', 'topic=Nope', 'topic=Hidden Topic']) {
      const meta = await resolveSeo('/courses/category', query)
      expect(meta.status).toBeUndefined()
      expect(meta).toEqual(catalogue)
    }
  })

  it('accepts Express-style query objects and ignores case in static segments', async () => {
    const meta = await resolveSeo('/About/', { utm: 'x' })
    expect(meta.canonical).toBe(`${env.siteUrl}/about`)
  })

  it('serves resource detail pages with their section’s static meta', async () => {
    const meta = await resolveSeo('/resources/playbooks/some-playbook')
    expect(meta.status).toBeUndefined()
    expect(meta.canonical).toBe(`${env.siteUrl}/resources/playbooks`)
  })

  it('404s a path that does not percent-decode', async () => {
    const meta = await resolveSeo('/courses/%E0%A4%A')
    expect(meta.status).toBe(404)
  })
})

describe('resolveSeo: records', () => {
  it('maps a public course to its own title, canonical and description', async () => {
    await course('seo-mastery', { title: 'SEO Mastery' })
    const meta = await resolveSeo('/courses/seo-mastery')
    expect(meta.status).toBeUndefined()
    expect(meta.title).toMatch(/^SEO Mastery \| /)
    expect(meta.canonical).toBe(`${env.siteUrl}/courses/seo-mastery`)
    expect(meta.description).toBe('What seo-mastery teaches.')
  })

  it('builds absolute URLs from the configured site URL and ignores the query string', async () => {
    await course('seo-mastery')
    const meta = await resolveSeo('/courses/seo-mastery/', 'utm_source=x&ref=y')
    expect(meta.canonical).toBe(`${env.siteUrl}/courses/seo-mastery`)
  })

  it.each([
    ['a Draft course', () => course('draft-course', { status: 'Draft' }), '/courses/draft-course'],
    [
      'a Hidden course',
      () => course('hidden-course', { visibility: 'Hidden' }),
      '/courses/hidden-course',
    ],
    ['an unknown course', async () => {}, '/courses/no-such-course'],
    [
      'a Draft post',
      () =>
        insertRow(blogPosts, {
          title: 'Draft',
          slug: 'draft-post',
          status: 'Draft',
          visibility: 'Public',
        }),
      '/blog/draft-post',
    ],
    ['an unknown program', async () => {}, '/programs/no-such-program'],
    ['an unknown workshop', async () => {}, '/workshops/no-such-workshop'],
    ['an unknown path', async () => {}, '/no/such/page'],
  ])('404s with the not-found meta for %s', async (_label, seed, path) => {
    await seed()
    const meta = await resolveSeo(path)
    expect(meta.status).toBe(404)
    expect(meta.title).toMatch(/^Page not found/)
  })

  it('makes a draft indistinguishable from a slug that never existed', async () => {
    await course('draft-course', { status: 'Draft', title: 'Secret Draft' })
    expect(await resolveSeo('/courses/draft-course')).toEqual(
      await resolveSeo('/courses/no-such-course'),
    )
  })

  it.each(['/admin', '/admin/anything', '/student/courses/x', '/community', '/checkout/seo'])(
    'marks %s noindex with status 200',
    async (path) => {
      const meta = await resolveSeo(path)
      expect(meta.status).toBeUndefined()
      expect(meta.robots).toMatch(/noindex/)
      expect(meta.canonical).toBe('')
    },
  )

  it('takes brand and logo from the cached site config, not a read per request', async () => {
    await updateSettings({ branding: { brandName: 'Acme Academy', logoUrl: '/brand.png' } })
    invalidateSiteConfig()
    expect((await resolveSeo('/about')).title).toBe('About Us | Acme Academy')

    // A write that bypasses invalidation is not seen until the cache is cleared.
    await updateSettings({ branding: { brandName: 'Renamed' } })
    expect((await resolveSeo('/about')).title).toBe('About Us | Acme Academy')
    invalidateSiteConfig()
    expect((await resolveSeo('/about')).title).toBe('About Us | Renamed')
  })
})
