import { test, expect } from '../fixtures/content'
import { bodyMarkup, jsonLdOfType, link, meta, title } from '../fixtures/html'

/**
 * SEO and edge behaviour, asserted on the raw server response. No browser: a
 * browser would run the client, which could paper over a tag the server never
 * sent — and crawlers do not wait for the client.
 *
 * Read-only: GETs only, with redirects off wherever a redirect is the subject.
 */

const BRAND = process.env.E2E_BRAND || 'Growth Scholar'

/** A session cookie that no session matches. The server must treat it as dummy. */
const DUMMY_SESSION = 'gs_at=e2e-not-a-real-token; gs_rt=e2e-not-a-real-token'

const text = async (res: { text(): Promise<string> }) => res.text()

test.describe('home page', () => {
  test('/ is 200 with title, description, canonical and Organization JSON-LD', async ({
    request,
  }) => {
    const res = await request.get('/')
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toContain('text/html')
    const html = await text(res)

    expect(title(html)).toContain(BRAND)
    expect(meta(html, 'description')?.length ?? 0).toBeGreaterThan(20)
    expect(link(html, 'canonical')).toMatch(/^https?:\/\//)

    const org = jsonLdOfType(html, 'Organization')
    expect(org, 'Organization JSON-LD on /').toBeDefined()
    expect(org?.name).toBeTruthy()
  })
})

test.describe('content pages', () => {
  test('course page has Course JSON-LD with a name and an offers price, and og:title', async ({
    request,
    discovered,
  }) => {
    const res = await request.get(`/courses/${discovered.course.slug}`)
    expect(res.status()).toBe(200)
    const html = await text(res)

    const course = jsonLdOfType(html, 'Course')
    expect(course, 'Course JSON-LD').toBeDefined()
    expect(course?.name).toBeTruthy()
    const offers = course?.offers as { price?: unknown } | undefined
    expect(offers, 'Course.offers').toBeDefined()
    expect(offers?.price, 'Course.offers.price').not.toBeUndefined()
    expect(Number.isNaN(Number(offers?.price))).toBe(false)

    expect(meta(html, 'og:title')).toBeTruthy()
  })

  test('blog post page has BlogPosting JSON-LD', async ({ request, discovered }) => {
    const res = await request.get(`/blog/${discovered.blogSlug}`)
    expect(res.status()).toBe(200)
    const post = jsonLdOfType(await text(res), 'BlogPosting')
    expect(post, 'BlogPosting JSON-LD').toBeDefined()
    expect(post?.headline).toBeTruthy()
  })

  test('workshop page has Event JSON-LD', async ({ request, discovered }) => {
    const res = await request.get(`/workshops/${discovered.workshopSlug}`)
    expect(res.status()).toBe(200)
    const event = jsonLdOfType(await text(res), 'Event')
    expect(event, 'Event JSON-LD').toBeDefined()
    expect(event?.name).toBeTruthy()
  })
})

test.describe('crawler files', () => {
  test('/sitemap.xml lists the discovered course, workshop and blog post', async ({
    request,
    discovered,
  }) => {
    const res = await request.get('/sitemap.xml')
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toMatch(/xml/)
    const locs = [...(await text(res)).matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1])
    // Compare paths, not origins: the sitemap carries the canonical site URL,
    // which differs from BASE_URL when the suite runs against a preview.
    const paths = new Set(locs.map((l) => new URL(l).pathname))

    expect(paths, 'course in sitemap').toContain(`/courses/${discovered.course.slug}`)
    expect(paths, 'workshop in sitemap').toContain(`/workshops/${discovered.workshopSlug}`)
    expect(paths, 'blog post in sitemap').toContain(`/blog/${discovered.blogSlug}`)
  })

  test('/robots.txt has a Sitemap line', async ({ request }) => {
    const res = await request.get('/robots.txt')
    expect(res.status()).toBe(200)
    expect(await text(res)).toMatch(/^Sitemap:\s*https?:\/\/\S+/im)
  })
})

test.describe('status codes and redirects', () => {
  test('an unknown course slug is a 404 whose HTML says noindex', async ({ request }) => {
    const res = await request.get(`/courses/e2e-no-such-course-${Date.now()}`)
    expect(res.status()).toBe(404)
    expect(res.headers()['content-type']).toContain('text/html')
    expect(meta(await text(res), 'robots')).toMatch(/noindex/i)
  })

  test('a legacy .html path is a 301, not followed', async ({ request }) => {
    const res = await request.get('/index.html', { maxRedirects: 0 })
    expect(res.status()).toBe(301)
    expect(res.headers()['location']).toBeTruthy()
  })

  test('/admin server HTML contains no admin markup', async ({ request }) => {
    const res = await request.get('/admin')
    // Whatever the status, the document a logged-out client receives must be an
    // empty shell: the admin chrome renders only in the browser, after auth.
    const markup = bodyMarkup(await text(res))
    expect(markup).not.toMatch(/Admin sections/i)
    expect(markup).not.toMatch(/<nav\b/i)
    expect(markup).not.toMatch(/<header\b/i)
    expect(markup).not.toMatch(/href="\/admin/i)
    expect(markup).not.toMatch(/\b(Customers|Transactions|Revenue)\b/)
  })

  test('/api/no-such is a JSON 404', async ({ request }) => {
    const res = await request.get('/api/no-such')
    expect(res.status()).toBe(404)
    expect(res.headers()['content-type']).toContain('application/json')
    const body = await res.json()
    expect(typeof body).toBe('object')
    expect(body).not.toBeNull()
  })
})

test.describe('caching', () => {
  test('a hashed static asset is immutable', async ({ request }) => {
    const html = await text(await request.get('/'))
    const asset = /(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/.exec(html)?.[1]
    expect(asset, 'a fingerprinted /assets/ file referenced from the home page').toBeTruthy()

    const res = await request.get(asset!)
    expect(res.status()).toBe(200)
    const cacheControl = res.headers()['cache-control'] ?? ''
    expect(cacheControl).toMatch(/immutable/)
    expect(cacheControl).toMatch(/max-age=\d{7,}/)
  })

  test('a request carrying a session cookie is never shared-cacheable', async ({ request }) => {
    // The cookie value is a dummy: the server rejects it, so these are the
    // routes that must stay private for every visitor, signed in or not.
    const page = await request.get('/login', { headers: { cookie: DUMMY_SESSION } })
    expect(page.status()).toBe(200)
    const pageCache = page.headers()['cache-control'] ?? ''
    expect(pageCache).toMatch(/private/)
    expect(pageCache).toMatch(/no-store/)

    const api = await request.get('/api/courses', { headers: { cookie: DUMMY_SESSION } })
    expect(api.headers()['cache-control'] ?? '').toMatch(/no-store/)
  })
})
