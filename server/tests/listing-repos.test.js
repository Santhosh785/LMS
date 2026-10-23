import { describe, expect, it } from 'vitest'
import { blogPosts, workshops } from '../src/db/schema/index.js'
import { listPublicPosts } from '../src/db/repos/blog.js'
import { listWorkshops } from '../src/db/repos/workshops.js'
import { insertRow } from './helpers/content.js'

/**
 * The listing queries behind GET /api/blog, GET /api/workshops and the
 * server-rendered /blog and /workshops pages. The pages put these rows
 * straight into HTML, so a Draft or Private post coming back from here would
 * be published to every visitor and every cache.
 */

const ago = (ms) => new Date(Date.now() - ms)
const post = (slug, over = {}) =>
  insertRow(blogPosts, {
    title: `Post ${slug}`,
    slug,
    status: 'Published',
    visibility: 'Public',
    publishedAt: ago(60_000),
    ...over,
  })

const slugsOf = (rows) => rows.map((r) => r.slug)

describe('listPublicPosts', () => {
  it('returns public posts only, in the list and in the featured spotlight', async () => {
    await post('public-post', { featured: true })
    await post('draft-post', { status: 'Draft', featured: true })
    await post('private-post', { visibility: 'Private', featured: true })
    await post('future-post', {
      status: 'Scheduled',
      publishedAt: new Date(Date.now() + 86_400_000),
      featured: true,
    })
    const result = await listPublicPosts({ category: 'latest' })
    expect(slugsOf(result.items)).toEqual(['public-post'])
    expect(slugsOf(result.featured)).toEqual(['public-post'])
    expect(result).toMatchObject({ total: 1, page: 1, pages: 1 })
    // Card columns only, document-shaped.
    expect(result.items[0]).not.toHaveProperty('body')
    expect(result.items[0]).not.toHaveProperty('revisions')
    expect(result.items[0]._id).toBe(result.items[0].id)
  })

  it('filters by category and search text and pages newest first', async () => {
    for (let i = 1; i <= 5; i += 1) {
      await post(`seo-${i}`, {
        title: `SEO guide ${i}`,
        category: 'SEO',
        publishedAt: ago(i * 60_000),
      })
    }
    await post('seo-other', { title: 'Unrelated', category: 'SEO' })
    await post('ads-1', { title: 'SEO for ads', category: 'Ads' })

    const page2 = await listPublicPosts({ category: 'SEO', q: ' guide ', page: 2, limit: 2 })
    expect(slugsOf(page2.items)).toEqual(['seo-3', 'seo-4'])
    expect(page2).toMatchObject({ total: 5, page: 2, pages: 3 })

    // Past the end: empty, with the real page count.
    const past = await listPublicPosts({ category: 'SEO', q: 'guide', page: 9, limit: 2 })
    expect(past.items).toEqual([])
    expect(past).toMatchObject({ page: 9, pages: 3 })

    // LIKE wildcards in the search text are literal.
    expect((await listPublicPosts({ q: '%' })).items).toEqual([])
  })
})

describe('listWorkshops', () => {
  it('filters by mode and orders by language, then start date', async () => {
    await insertRow(workshops, {
      title: 'Tamil late',
      slug: 'tamil-late',
      mode: 'online',
      language: 'Tamil',
      startsAt: ago(-2 * 86_400_000),
    })
    await insertRow(workshops, {
      title: 'Tamil early',
      slug: 'tamil-early',
      mode: 'online',
      language: 'Tamil',
      startsAt: ago(-86_400_000),
    })
    await insertRow(workshops, {
      title: 'English',
      slug: 'english',
      mode: 'online',
      language: 'English',
    })
    await insertRow(workshops, {
      title: 'Chennai',
      slug: 'chennai',
      mode: 'offline',
      venue: 'Chennai',
    })

    const online = await listWorkshops({ mode: 'online' })
    expect(slugsOf(online)).toEqual(['english', 'tamil-early', 'tamil-late'])
    expect(online[0]._id).toBe(online[0].id)
    expect(slugsOf(await listWorkshops({ mode: 'offline' }))).toEqual(['chennai'])
    expect(await listWorkshops()).toHaveLength(4)
  })
})
