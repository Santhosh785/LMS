import { describe, expect, it } from 'vitest'
import { blogPosts, programs, workshops } from '../src/db/schema/index.js'
import {
  createCourse,
  findPublicBySlug,
  listPublic,
  listPublicCourseSlugs,
} from '../src/db/repos/courses.js'
import { findPublicPostBySlug, listPublicPostSlugs } from '../src/db/repos/blog.js'
import { listProgramSlugs } from '../src/db/repos/programs.js'
import { listWorkshopSlugs } from '../src/db/repos/workshops.js'
import { insertRow } from './helpers/content.js'

/**
 * The public-visibility rules, read straight from the repo layer.
 *
 * The public API, the sitemap and the SEO resolver all lean on these helpers,
 * so a Draft course or post leaking through one of them would leak through all
 * three. Each test seeds one row on each side of the rule and asserts which
 * side comes back.
 */

const VIDEO_ID = 'bunny-guid-must-not-leak'
const VIDEO_URL = 'https://video.example.in/must-not-leak.mp4'

const course = (slug, over = {}) =>
  createCourse({
    title: `Course ${slug}`,
    slug,
    price: 'paid',
    amount: 999,
    status: 'Published',
    visibility: 'Public',
    sections: [
      {
        name: 'Module 1',
        lessons: [
          { name: 'Video lesson', contentType: 'Video', bunnyVideoId: VIDEO_ID },
          { name: 'Hosted lesson', contentType: 'Video', videoUrl: VIDEO_URL },
        ],
      },
    ],
    ...over,
  })

/** One course per side of the rule: public, Draft, and Published-but-Hidden. */
async function seedCourses() {
  await course('public-course')
  await course('draft-course', { status: 'Draft' })
  await course('hidden-course', { visibility: 'Hidden' })
}

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

const slugsOf = (rows) => rows.map((r) => r.slug).sort()

describe('public course helpers', () => {
  it('findPublicBySlug returns only a published, public course', async () => {
    await seedCourses()
    const found = await findPublicBySlug('public-course')
    expect(found?.slug).toBe('public-course')
    // Slugs are matched case-insensitively, as the route always has.
    expect((await findPublicBySlug('PUBLIC-Course'))?.slug).toBe('public-course')
    expect(await findPublicBySlug('draft-course')).toBeNull()
    expect(await findPublicBySlug('hidden-course')).toBeNull()
    expect(await findPublicBySlug('no-such-course')).toBeNull()
  })

  it('findPublicBySlug strips every video reference', async () => {
    await seedCourses()
    const found = await findPublicBySlug('public-course')
    const lessonsOut = found.sections.flatMap((s) => s.lessons)
    expect(lessonsOut).toHaveLength(2)
    for (const lesson of lessonsOut) {
      expect(lesson).not.toHaveProperty('bunnyVideoId')
      expect(lesson).not.toHaveProperty('videoUrl')
      expect(lesson.hasVideo).toBe(true)
    }
    const serialized = JSON.stringify(found)
    expect(serialized).not.toContain(VIDEO_ID)
    expect(serialized).not.toContain(VIDEO_URL)
  })

  it('findPublicBySlug skips lessons when curriculum is false', async () => {
    await seedCourses()
    const found = await findPublicBySlug('public-course', { curriculum: false })
    expect(found.sections).toHaveLength(1)
    expect(found.sections[0].lessons).toEqual([])
    expect(await findPublicBySlug('draft-course', { curriculum: false })).toBeNull()
  })

  it('listPublic lists and counts only public courses', async () => {
    await seedCourses()
    const { items, total } = await listPublic({})
    expect(total).toBe(1)
    expect(slugsOf(items)).toEqual(['public-course'])
    // Catalogue cards: `_id` for the client, no heavy page-only columns.
    expect(items[0]._id).toBe(items[0].id)
    expect(items[0]).not.toHaveProperty('overview')
  })

  it('listPublic keeps the legacy "paid only" default and pages with limit/offset', async () => {
    await course('paid-a', { popularity: 3 })
    await course('paid-b', { popularity: 2 })
    await course('free-c', { price: 'free', amount: 0, popularity: 1 })

    expect((await listPublic({})).total).toBe(2)
    expect((await listPublic({ price: 'free,paid' })).total).toBe(3)

    const first = await listPublic({ price: 'free,paid', limit: '2' })
    expect(first.total).toBe(3)
    expect(first.items.map((c) => c.slug)).toEqual(['paid-a', 'paid-b'])
    const second = await listPublic({ price: 'free,paid', limit: '2', offset: '2' })
    expect(second.items.map((c) => c.slug)).toEqual(['free-c'])
    const past = await listPublic({ price: 'free,paid', limit: '2', offset: '10' })
    expect(past).toEqual({ items: [], total: 3 })
  })

  it('listPublicCourseSlugs returns { slug, updatedAt } for public courses only', async () => {
    await seedCourses()
    const rows = await listPublicCourseSlugs()
    expect(slugsOf(rows)).toEqual(['public-course'])
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual(['slug', 'updatedAt'])
      expect(row.updatedAt).toBeInstanceOf(Date)
    }
  })
})

describe('public blog helpers', () => {
  async function seedPosts() {
    await post('public-post')
    await post('draft-post', { status: 'Draft' })
    await post('private-post', { visibility: 'Private' })
    await post('scheduled-due', { status: 'Scheduled', publishedAt: ago(60_000) })
    await post('scheduled-future', {
      status: 'Scheduled',
      publishedAt: new Date(Date.now() + 86_400_000),
    })
  }

  it('findPublicPostBySlug returns public posts and nothing else', async () => {
    await seedPosts()
    expect((await findPublicPostBySlug('public-post'))?.slug).toBe('public-post')
    expect((await findPublicPostBySlug('scheduled-due'))?.slug).toBe('scheduled-due')
    expect(await findPublicPostBySlug('draft-post')).toBeNull()
    expect(await findPublicPostBySlug('private-post')).toBeNull()
    expect(await findPublicPostBySlug('scheduled-future')).toBeNull()
    // The default select is the article page's: no revision history.
    expect(await findPublicPostBySlug('public-post')).not.toHaveProperty('revisions')
  })

  it('listPublicPostSlugs returns { slug, updatedAt } for public posts only', async () => {
    await seedPosts()
    const rows = await listPublicPostSlugs()
    expect(slugsOf(rows)).toEqual(['public-post', 'scheduled-due'])
    for (const row of rows) expect(Object.keys(row).sort()).toEqual(['slug', 'updatedAt'])
  })
})

describe('program and workshop slug listers', () => {
  it('listProgramSlugs returns every program', async () => {
    await insertRow(programs, { title: 'Program A', slug: 'program-a' })
    await insertRow(programs, { title: 'Program B', slug: 'program-b' })
    const rows = await listProgramSlugs()
    expect(slugsOf(rows)).toEqual(['program-a', 'program-b'])
    for (const row of rows) expect(Object.keys(row).sort()).toEqual(['slug', 'updatedAt'])
  })

  it('listWorkshopSlugs returns every workshop', async () => {
    await insertRow(workshops, { title: 'Workshop A', slug: 'workshop-a' })
    await insertRow(workshops, { title: 'Workshop B', slug: 'workshop-b', mode: 'offline' })
    const rows = await listWorkshopSlugs()
    expect(slugsOf(rows)).toEqual(['workshop-a', 'workshop-b'])
    for (const row of rows) expect(Object.keys(row).sort()).toEqual(['slug', 'updatedAt'])
  })
})
