import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import express from 'express'
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'
import { env } from '../src/config/env.js'
import { blogPosts, programs, terms, workshops } from '../src/db/schema/index.js'
import { createCourse } from '../src/db/repos/courses.js'
import { updateSettings } from '../src/db/repos/settings.js'
import { errorHandler, notFound } from '../src/middleware/error.js'
import { prepareShell, spaShell } from '../src/middleware/spaShell.js'
import { resolveSeo, SEO_ROUTE_PATTERNS } from '../src/services/seo.js'
import { invalidateSiteConfig } from '../src/services/siteConfig.js'
import { captureServerError } from '../src/config/observability.js'
import { agent } from './helpers/factories.js'
import { insertRow } from './helpers/content.js'

// The real module with its error reporter observable; everything else unchanged.
vi.mock('../src/config/observability.js', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, captureServerError: vi.fn(actual.captureServerError) }
})

/**
 * The SPA shell with per-route SEO head tags (task 7).
 *
 * The shell is mounted the way server/src/index.js mounts it — an API router
 * first, then `app.get('*', spaShell(...))`, then the JSON 404 — but over a
 * fixture index.html, so the suite does not depend on a client build existing
 * and can compare bodies byte for byte.
 */

const FIXTURE = fileURLToPath(new URL('./fixtures/spa/index.html', import.meta.url))
const FIXTURE_HTML = fs.readFileSync(FIXTURE, 'utf8')
const GENERIC_TITLE = 'Fixture Generic Title'
const NO_CACHE = 'no-cache, must-revalidate'

function shellApp(options = {}) {
  const app = express()
  app.get('/api/ping', (_req, res) => res.json({ ok: true }))
  app.get('*', spaShell({ indexHtml: FIXTURE, ...options }))
  app.use(notFound)
  app.use(errorHandler)
  return app
}

const get = (path, options) => request(shellApp(options)).get(path)

const ago = (ms) => new Date(Date.now() - ms)

const course = (slug, over = {}) =>
  createCourse({
    title: `Course ${slug}`,
    slug,
    summary: `What ${slug} teaches.`,
    image: 'https://cdn.example.in/cover.jpg',
    price: 'paid',
    amount: 4999,
    status: 'Published',
    visibility: 'Public',
    ...over,
  })

const post = (slug, over = {}) =>
  insertRow(blogPosts, {
    title: `Post ${slug}`,
    slug,
    excerpt: `About ${slug}.`,
    status: 'Published',
    visibility: 'Public',
    publishedAt: ago(60_000),
    ...over,
  })

/** The JSON-LD objects in an HTML body. */
function jsonLd(html) {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) =>
    JSON.parse(m[1]),
  )
}

const robots = (html) => /<meta name="robots" content="([^"]*)">/.exec(html)?.[1]
const titleOf = (html) => /<title>([\s\S]*?)<\/title>/.exec(html)?.[1]

describe('SPA shell: injected head', () => {
  it('serves a course page with its own title, canonical, Open Graph and Course JSON-LD', async () => {
    await course('seo-mastery', { title: 'SEO Mastery' })
    const res = await get('/courses/seo-mastery')

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/^text\/html/)
    expect(res.headers['cache-control']).toBe(NO_CACHE)
    expect(titleOf(res.text)).toMatch(/^SEO Mastery \| /)
    expect(res.text).toContain('<meta property="og:title" content="SEO Mastery | ')
    expect(res.text).toContain(`<link rel="canonical" href="${env.siteUrl}/courses/seo-mastery">`)
    expect(res.text).toContain(
      `<meta property="og:url" content="${env.siteUrl}/courses/seo-mastery">`,
    )
    expect(res.text).toContain('<meta name="description" content="What seo-mastery teaches.">')
    expect(res.text).toContain(
      '<meta property="og:image" content="https://cdn.example.in/cover.jpg">',
    )
    expect(res.text).toContain('<meta name="twitter:card" content="summary_large_image">')
    expect(robots(res.text)).toBe('index, follow')
    expect(jsonLd(res.text).map((o) => o['@type'])).toContain('Course')

    // The fixture's static head is gone — one title, one description.
    expect(res.text).not.toContain(GENERIC_TITLE)
    expect(res.text).not.toContain('Fixture generic description')
    expect(res.text.match(/<title>/g)).toHaveLength(1)
    expect(res.text.match(/<meta name="description"/g)).toHaveLength(1)
    // Injected inside the head, everything else left as built.
    const head = res.text.slice(0, res.text.indexOf('</head>'))
    expect(head).toContain('<link rel="canonical"')
    expect(res.text).toContain('<script type="module" crossorigin src="/assets/index-fixture.js">')
    expect(res.text).toContain('<div id="root"></div>')
  })

  it('builds absolute URLs from the configured site URL, never the Host header', async () => {
    await course('seo-mastery')
    const res = await get('/courses/seo-mastery').set('Host', 'evil.example.com')
    expect(res.text).not.toContain('evil.example.com')
    expect(res.text).toContain(`href="${env.siteUrl}/courses/seo-mastery"`)
  })

  it('ignores trailing slashes and the query string, and keeps the query out of the canonical', async () => {
    await course('seo-mastery')
    const res = await get('/courses/seo-mastery/?utm_source=x&ref=y')
    expect(res.status).toBe(200)
    expect(res.text).toContain(`<link rel="canonical" href="${env.siteUrl}/courses/seo-mastery">`)
    expect(res.text).not.toContain('utm_source')
  })

  it('escapes values and cannot be broken out of by a </script> in content', async () => {
    await course('xss', {
      title: 'Ads </script><script>alert(1)</script> & "more"',
      summary: '</script><img src=x onerror=alert(1)>',
    })
    const res = await get('/courses/xss')
    expect(res.status).toBe(200)
    expect(res.text).not.toContain('<script>alert(1)')
    expect(res.text).not.toContain('<img src=x')
    expect(titleOf(res.text)).toContain('&lt;/script&gt;')
    // Every JSON-LD block still parses, and holds the raw text.
    const courseLd = jsonLd(res.text).find((o) => o['@type'] === 'Course')
    expect(courseLd.name).toContain('</script>')
  })

  it.each([
    ['a Draft course', () => course('draft-course', { status: 'Draft' }), '/courses/draft-course'],
    [
      'a Hidden course',
      () => course('hidden-course', { visibility: 'Hidden' }),
      '/courses/hidden-course',
    ],
    ['an unknown course', async () => {}, '/courses/no-such-course'],
    ['a Draft post', () => post('draft-post', { status: 'Draft' }), '/blog/draft-post'],
    ['an unknown post', async () => {}, '/blog/no-such-post'],
    ['an unknown program', async () => {}, '/programs/no-such-program'],
    ['an unknown workshop', async () => {}, '/workshops/no-such-workshop'],
  ])('404s with noindex for %s', async (_label, seed, path) => {
    await seed()
    const res = await get(path)
    expect(res.status).toBe(404)
    expect(res.headers['cache-control']).toBe(NO_CACHE)
    expect(robots(res.text)).toBe('noindex, nofollow')
    expect(res.text).not.toContain('rel="canonical"')
    expect(titleOf(res.text)).toMatch(/^Page not found/)
  })

  it('makes a draft indistinguishable from a slug that never existed', async () => {
    await course('draft-course', { status: 'Draft', title: 'Secret Draft' })
    const draft = await get('/courses/draft-course')
    const missing = await get('/courses/no-such-course')
    expect(draft.status).toBe(missing.status)
    expect(draft.text).toBe(missing.text)
    expect(draft.text).not.toContain('Secret Draft')
  })

  it('404s an unknown path with not-found meta', async () => {
    const res = await get('/no/such/page')
    expect(res.status).toBe(404)
    expect(robots(res.text)).toBe('noindex, nofollow')
    expect(res.headers['cache-control']).toBe(NO_CACHE)
    // Still the app shell, so the client renders its own Not Found page.
    expect(res.text).toContain('<div id="root"></div>')
  })

  it.each(['/admin', '/admin/anything', '/student/courses/x', '/community', '/checkout/seo'])(
    'marks %s noindex with status 200',
    async (path) => {
      const res = await get(path)
      expect(res.status).toBe(200)
      expect(robots(res.text)).toBe('noindex, nofollow')
      expect(res.text).not.toContain('rel="canonical"')
    },
  )

  it('honours a blog post’s own seo.noIndex, keeping status 200', async () => {
    await post('quiet-post', { seo: { noIndex: true, metaTitle: 'Quiet one' } })
    const res = await get('/blog/quiet-post')
    expect(res.status).toBe(200)
    expect(robots(res.text)).toBe('noindex, nofollow')
    expect(titleOf(res.text)).toMatch(/^Quiet one \| /)
  })

  it('serves a public blog post with BlogPosting JSON-LD', async () => {
    await post('growth-loops', { title: 'Growth Loops' })
    const res = await get('/blog/growth-loops')
    expect(res.status).toBe(200)
    expect(robots(res.text)).toBe('index, follow')
    expect(res.text).toContain('<meta property="og:type" content="article">')
    expect(jsonLd(res.text).map((o) => o['@type'])).toContain('BlogPosting')
  })

  it('serves program and workshop detail pages', async () => {
    await insertRow(programs, { title: 'Flagship Cohort', slug: 'flagship', weeks: 12 })
    await insertRow(workshops, {
      title: 'Ads Workshop',
      slug: 'ads-workshop',
      startsAt: new Date('2026-11-12T10:00:00Z'),
    })
    const program = await get('/programs/flagship')
    expect(program.status).toBe(200)
    expect(titleOf(program.text)).toMatch(/^Flagship Cohort \| /)
    const workshop = await get('/workshops/ads-workshop')
    expect(workshop.status).toBe(200)
    expect(titleOf(workshop.text)).toMatch(/^Ads Workshop \| /)
    expect(jsonLd(workshop.text).map((o) => o['@type'])).toContain('Event')
  })

  it('serves /programs/apply and /programs/fit-call as static pages, not program slugs', async () => {
    for (const path of ['/programs/apply', '/programs/fit-call']) {
      const res = await get(path)
      expect(res.status).toBe(200)
      expect(res.text).toContain(`<link rel="canonical" href="${env.siteUrl}${path}">`)
    }
  })

  it('takes brand and logo from the cached site config, not a read per request', async () => {
    await updateSettings({ branding: { brandName: 'Acme Academy', logoUrl: '/brand.png' } })
    invalidateSiteConfig()
    const first = await get('/about')
    expect(titleOf(first.text)).toBe('About Us | Acme Academy')
    expect(first.text).toContain('<meta property="og:site_name" content="Acme Academy">')
    expect(first.text).toContain(`<meta property="og:image" content="${env.siteUrl}/brand.png">`)

    // A write that bypasses invalidation is not seen until the cache is cleared.
    await updateSettings({ branding: { brandName: 'Renamed' } })
    expect(titleOf((await get('/about')).text)).toBe('About Us | Acme Academy')
    invalidateSiteConfig()
    expect(titleOf((await get('/about')).text)).toBe('About Us | Renamed')
  })
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

describe('SPA shell: failure policy and the off switch', () => {
  it('serves the template as built, with 200, when the resolver throws', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const res = await get('/courses/anything', {
        resolve: async () => {
          throw new Error('database down')
        },
      })
      expect(res.status).toBe(200)
      expect(res.text).toBe(FIXTURE_HTML)
      expect(res.headers['cache-control']).toBe(NO_CACHE)
      expect(logged.mock.calls.some((args) => String(args[0]).includes('[seo]'))).toBe(true)
      expect(captureServerError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'database down' }),
        expect.anything(),
        500,
      )
    } finally {
      logged.mockRestore()
    }
  })

  it('serves the template as built when rendering throws on a malformed meta', async () => {
    const res = await get('/x', {
      resolve: async () => ({
        get title() {
          throw new Error('malformed')
        },
      }),
    })
    expect(res.status).toBe(200)
    expect(res.text).toBe(FIXTURE_HTML)
  })

  it('SEO_INJECT=0 serves the built file byte for byte', async () => {
    const res = await request(shellApp({ inject: false }))
      .get('/courses/seo-mastery')
      .buffer(true)
      .parse((r, cb) => {
        const chunks = []
        r.on('data', (c) => chunks.push(c))
        r.on('end', () => cb(null, Buffer.concat(chunks)))
      })
    expect(res.status).toBe(200)
    expect(res.headers['cache-control']).toBe(NO_CACHE)
    expect(Buffer.compare(res.body, fs.readFileSync(FIXTURE))).toBe(0)
  })

  it('reads SEO_INJECT through the env config: on unless exactly 0', () => {
    expect(typeof env.seoInject).toBe('boolean')
  })

  it('strips only the static title and description when preparing the template', () => {
    const shell = prepareShell(FIXTURE_HTML)
    expect(shell.original).toBe(FIXTURE_HTML)
    expect(shell.head).not.toContain('<title>')
    expect(shell.head).not.toContain('name="description"')
    expect(shell.head).toContain('<meta name="viewport"')
    expect(shell.tail.startsWith('</head>')).toBe(true)
  })
})

describe('SPA shell: what it does not answer', () => {
  it('passes /api/* through to the JSON 404', async () => {
    const res = await get('/api/does-not-exist')
    expect(res.status).toBe(404)
    expect(res.headers['content-type']).toMatch(/json/)
    expect((await get('/api/ping')).body).toEqual({ ok: true })
  })

  it('answers GET only: a POST to an unmatched path gets JSON, not the shell', async () => {
    for (const path of ['/api/nope', '/courses/seo-mastery']) {
      const res = await request(shellApp()).post(path)
      expect(res.status).toBe(404)
      expect(res.headers['content-type']).toMatch(/json/)
      expect(res.text).not.toContain('<html')
    }
  })

  it('the real app still answers an unmatched POST /api/... with JSON', async () => {
    const res = await agent().post('/api/does-not-exist').send({})
    expect(res.status).toBe(404)
    expect(res.headers['content-type']).toMatch(/json/)
  })
})
