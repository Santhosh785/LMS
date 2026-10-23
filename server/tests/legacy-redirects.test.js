import { describe, expect, it } from 'vitest'
import { agent } from './helpers/factories.js'
import { LEGACY_HTML_REDIRECTS } from '../src/middleware/legacyRedirect.js'

describe('legacy .html redirects', () => {
  it('covers the full 43-entry table', () => {
    expect(LEGACY_HTML_REDIRECTS.size).toBe(43)
  })

  it.each([...LEGACY_HTML_REDIRECTS])('301s %s to %s', async (from, to) => {
    const res = await agent().get(from).redirects(0)
    expect(res.status).toBe(301)
    expect(res.headers.location).toBe(to)
  })

  it('preserves the query string', async () => {
    const res = await agent().get('/courses/seo.html?ref=abc').redirects(0)
    expect(res.status).toBe(301)
    expect(res.headers.location).toBe('/courses/seo-mastery?ref=abc')
  })

  it('301s /index.html to /', async () => {
    const res = await agent().get('/index.html').redirects(0)
    expect(res.status).toBe(301)
    expect(res.headers.location).toBe('/')
  })

  it('answers HEAD with the same redirect', async () => {
    const res = await agent().head('/courses/seo.html').redirects(0)
    expect(res.status).toBe(301)
    expect(res.headers.location).toBe('/courses/seo-mastery')
  })

  it('does not redirect non-GET/HEAD requests', async () => {
    const res = await agent().post('/courses/seo.html').redirects(0)
    expect(res.status).not.toBe(301)
  })

  it.each([
    '/courses/unknown.html',
    '/about',
    '/courses',
    '/courses/seo.html/',
    '/COURSES/SEO.HTML',
  ])('lets %s fall through', async (path) => {
    const res = await agent().get(path).redirects(0)
    expect(res.status).not.toBe(301)
  })

  it('leaves API routes alone', async () => {
    const res = await agent().get('/api/health').redirects(0)
    expect(res.status).toBe(200)
  })
})
