import { beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { agent } from './helpers/factories.js'
import { insertRow } from './helpers/content.js'
import { db } from '../src/db/index.js'
import { blogPosts, courses, programs, terms, workshops } from '../src/db/schema/index.js'
import { createCourse } from '../src/db/repos/courses.js'
import { env } from '../src/config/env.js'
import {
  ROBOTS_DISALLOW,
  STATIC_SITEMAP_PATHS,
  escapeXml,
  invalidateSitemap,
} from '../src/services/sitemap.js'

/**
 * GET /sitemap.xml and GET /robots.txt, through the real app.
 *
 * The sitemap is memoized for ten minutes, and the database is wiped between
 * tests, so every test starts from a cleared memo.
 */

const base = env.siteUrl
const url = (path) => `<loc>${escapeXml(`${base}${path}`)}</loc>`

/**
 * A well-formedness check strict enough for a sitemap: an XML declaration, one
 * root element, properly nested and closed tags, and no bare `<` or `&` in text
 * or attribute values. The server has no XML parser dependency, and a sitemap
 * uses none of the constructs (CDATA, DTDs, comments) this does not handle.
 */
function assertWellFormedXml(xml) {
  const decl = /^<\?xml version="1\.0" encoding="UTF-8"\?>\s*/
  expect(xml).toMatch(decl)
  const body = xml.replace(decl, '')
  const ENTITY = /&(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/g
  const cleanText = (s) => !/[<>]/.test(s) && !s.replace(ENTITY, '').includes('&')

  const stack = []
  let roots = 0
  const TOKEN = /<(\/?)([A-Za-z_][\w.-]*)((?:\s+[\w:.-]+="[^"]*")*)\s*(\/?)>|([^<]+)/gy
  let match
  let consumed = 0
  while ((match = TOKEN.exec(body))) {
    consumed = TOKEN.lastIndex
    const [, closing, name, attrs, selfClosing, text] = match
    if (text !== undefined) {
      if (!stack.length) expect(text.trim()).toBe('')
      expect(cleanText(text), `bad text: ${text}`).toBe(true)
      continue
    }
    for (const [, value] of (attrs || '').matchAll(/="([^"]*)"/g)) {
      expect(cleanText(value), `bad attribute: ${value}`).toBe(true)
    }
    if (closing) {
      expect(stack.pop(), `unbalanced </${name}>`).toBe(name)
    } else {
      if (!stack.length) roots += 1
      if (!selfClosing) stack.push(name)
    }
  }
  expect(consumed, 'unparseable markup').toBe(body.length)
  expect(stack).toEqual([])
  expect(roots).toBe(1)
}

const course = (slug, over = {}) =>
  createCourse({
    title: `Course ${slug}`,
    slug,
    price: 'paid',
    amount: 999,
    status: 'Published',
    visibility: 'Public',
    ...over,
  })

async function seed() {
  await course('published-course')
  await course('draft-course', { status: 'Draft' })
  await course('hidden-course', { visibility: 'Hidden' })
  await insertRow(blogPosts, {
    title: 'Public post',
    slug: 'public-post',
    status: 'Published',
    visibility: 'Public',
    publishedAt: new Date(Date.now() - 60_000),
  })
  await insertRow(blogPosts, { title: 'Draft post', slug: 'draft-post', status: 'Draft' })
  await insertRow(programs, { title: 'Program A', slug: 'program-a' })
  await insertRow(workshops, { title: 'Workshop A', slug: 'workshop-a' })
  await insertRow(terms, { taxonomy: 'topic', name: 'SEO & Content', slug: 'seo-content' })
  await insertRow(terms, {
    taxonomy: 'topic',
    name: 'Not a filter',
    slug: 'not-a-filter',
    showInFilters: false,
  })
}

beforeEach(() => invalidateSitemap())

describe('GET /sitemap.xml', () => {
  it('is well-formed XML with the cache headers', async () => {
    await seed()
    const res = await agent().get('/sitemap.xml').expect(200)
    expect(res.headers['content-type']).toMatch(/^application\/xml/)
    expect(res.headers['cache-control']).toBe('public, max-age=600')
    assertWellFormedXml(res.text)
    expect(res.text).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
  })

  it('lists published courses and leaves drafts and hidden courses out', async () => {
    await seed()
    const { text } = await agent().get('/sitemap.xml').expect(200)
    expect(text).toContain(url('/courses/published-course'))
    expect(text).not.toContain('draft-course')
    expect(text).not.toContain('hidden-course')
  })

  it('lists public blog posts, programs and workshops, and no draft posts', async () => {
    await seed()
    const { text } = await agent().get('/sitemap.xml').expect(200)
    expect(text).toContain(url('/blog/public-post'))
    expect(text).not.toContain('draft-post')
    expect(text).toContain(url('/programs/program-a'))
    expect(text).toContain(url('/workshops/workshop-a'))
  })

  it('lists every static page as an absolute URL without lastmod', async () => {
    const { text } = await agent().get('/sitemap.xml').expect(200)
    expect(base).toMatch(/^https?:\/\//)
    for (const path of STATIC_SITEMAP_PATHS) {
      expect(text).toContain(`<url>\n    ${url(path)}\n  </url>`)
    }
  })

  it('lists filter-visible topics as encoded category URLs', async () => {
    await seed()
    const { text } = await agent().get('/sitemap.xml').expect(200)
    expect(text).toContain(url('/courses/category?topic=SEO%20%26%20Content'))
    expect(text).not.toContain('Not%20a%20filter')
  })

  it('writes lastmod as the ISO date of updatedAt', async () => {
    await seed()
    await db
      .update(courses)
      .set({ updatedAt: new Date('2026-03-04T10:00:00Z') })
      .where(eq(courses.slug, 'published-course'))
    const { text } = await agent().get('/sitemap.xml').expect(200)
    expect(text).toContain(`${url('/courses/published-course')}\n    <lastmod>2026-03-04</lastmod>`)
  })

  it('is memoized until invalidateSitemap() is called', async () => {
    const before = await agent().get('/sitemap.xml').expect(200)
    expect(before.text).not.toContain('published-course')

    await course('published-course')
    const cached = await agent().get('/sitemap.xml').expect(200)
    expect(cached.text).toBe(before.text)

    invalidateSitemap()
    const fresh = await agent().get('/sitemap.xml').expect(200)
    expect(fresh.text).toContain(url('/courses/published-course'))
  })
})

describe('escapeXml', () => {
  it('escapes the five XML special characters', () => {
    expect(escapeXml(`a&b<c>d"e'f`)).toBe('a&amp;b&lt;c&gt;d&quot;e&apos;f')
  })
})

describe('GET /robots.txt', () => {
  it('disallows the private areas and points at the absolute sitemap', async () => {
    const res = await agent().get('/robots.txt').expect(200)
    expect(res.headers['content-type']).toMatch(/^text\/plain/)
    const lines = res.text.split('\n')
    expect(lines[0]).toBe('User-agent: *')
    expect(ROBOTS_DISALLOW).toHaveLength(10)
    for (const path of [
      '/admin',
      '/student',
      '/community',
      '/api',
      '/checkout',
      '/login',
      '/signup',
      '/forgot-password',
      '/reset-password',
      '/uploads',
    ]) {
      expect(lines).toContain(`Disallow: ${path}`)
    }
    expect(lines).toContain(`Sitemap: ${base}/sitemap.xml`)
    expect(res.text).toBe(
      [
        'User-agent: *',
        ...ROBOTS_DISALLOW.map((p) => `Disallow: ${p}`),
        '',
        `Sitemap: ${base}/sitemap.xml`,
        '',
      ].join('\n'),
    )
  })
})
