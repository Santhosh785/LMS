import { describe, expect, it } from 'vitest'
import { BlogPost, Course, Program } from '../src/models/index.js'
import Term from '../src/models/Term.js'
import { agent, paidCourse, signUpAdmin } from './helpers/factories.js'

/**
 * The term registry (TAX-1…TAX-5).
 *
 * The load-bearing property is that the registry and the content never drift
 * apart: content documents store a term's name, so every rename, merge and
 * delete has to repoint the documents that reference it. A term list that
 * disagrees with the content silently empties the catalogue's filters.
 */

const makeTerm = (over = {}) =>
  Term.create({ taxonomy: 'topic', name: 'SEO', slug: 'seo', ...over })

async function adminAgent() {
  const { cookie } = await signUpAdmin()
  return (method, url) => agent()[method](url).set('Cookie', cookie)
}

describe('term registry', () => {
  it('derives a unique slug and refuses a nameless term', async () => {
    const as = await adminAgent()

    const created = await as('post', '/api/admin/taxonomy')
      .send({ taxonomy: 'category', name: 'Paid Media' })
      .expect(201)
    expect(created.body.slug).toBe('paid-media')

    const duplicate = await as('post', '/api/admin/taxonomy')
      .send({ taxonomy: 'category', name: 'Paid Media' })
      .expect(201)
    expect(duplicate.body.slug).toBe('paid-media-2')

    await as('post', '/api/admin/taxonomy').send({ taxonomy: 'category', name: '  ' }).expect(400)
  })

  it('reports how many documents use a term', async () => {
    const as = await adminAgent()
    await paidCourse({ topic: 'SEO' })
    const term = await makeTerm()

    const res = await as('get', `/api/admin/taxonomy/${term._id}/usage`).expect(200)
    expect(res.body.total).toBe(1)
  })

  it('repoints every referencing document when a term is renamed', async () => {
    const as = await adminAgent()
    const course = await paidCourse({ topic: 'SEO' })
    const term = await makeTerm()

    const res = await as('put', `/api/admin/taxonomy/${term._id}`)
      .send({ name: 'Search Marketing' })
      .expect(200)

    expect(res.body.reassigned).toBe(1)
    expect((await Course.findById(course._id)).topic).toBe('Search Marketing')
  })

  it('keeps the old slug resolving after a slug change', async () => {
    const as = await adminAgent()
    const term = await makeTerm()

    await as('put', `/api/admin/taxonomy/${term._id}`).send({ slug: 'search' }).expect(200)

    const stored = await Term.findById(term._id)
    expect(stored.slug).toBe('search')
    expect(stored.formerSlugs).toContain('seo')
  })

  it('merges one term into another, moving its content and its slug', async () => {
    const as = await adminAgent()
    const course = await paidCourse({ topic: 'PPC' })
    const source = await makeTerm({ name: 'PPC', slug: 'ppc' })
    const target = await makeTerm({ name: 'Paid Media', slug: 'paid-media' })

    const res = await as('post', '/api/admin/taxonomy/merge')
      .send({ sourceId: source._id, targetId: target._id })
      .expect(200)

    expect(res.body.moved).toBe(1)
    expect((await Course.findById(course._id)).topic).toBe('Paid Media')
    expect(await Term.findById(source._id)).toBeNull()
    expect((await Term.findById(target._id)).formerSlugs).toContain('ppc')
  })

  it('refuses to delete a term still in use unless told what to do with it', async () => {
    const as = await adminAgent()
    const course = await paidCourse({ topic: 'SEO' })
    const term = await makeTerm()
    const replacement = await makeTerm({ name: 'Organic', slug: 'organic' })

    await as('delete', `/api/admin/taxonomy/${term._id}`).expect(409)
    expect(await Term.findById(term._id)).not.toBeNull()

    await as('delete', `/api/admin/taxonomy/${term._id}?replaceWith=${replacement._id}`).expect(200)
    expect((await Course.findById(course._id)).topic).toBe('Organic')
    expect(await Term.findById(term._id)).toBeNull()
  })

  it('strips the reference when a used term is force-deleted', async () => {
    const as = await adminAgent()
    const post = await BlogPost.create({
      title: 'A post',
      slug: 'a-post',
      category: 'Career',
      tags: ['Career'],
    })
    const tag = await makeTerm({ taxonomy: 'tag', name: 'Career', slug: 'career' })

    await as('delete', `/api/admin/taxonomy/${tag._id}?force=true`).expect(200)
    expect((await BlogPost.findById(post._id)).tags).toEqual([])
  })

  it('rejects a parent that would create a loop', async () => {
    const as = await adminAgent()
    const parent = await makeTerm({ taxonomy: 'category', name: 'Marketing', slug: 'marketing' })
    const child = await makeTerm({
      taxonomy: 'category',
      name: 'SEO',
      slug: 'seo',
      parent: parent._id,
    })

    await as('put', `/api/admin/taxonomy/${parent._id}`).send({ parent: child._id }).expect(400)
    await as('put', `/api/admin/taxonomy/${child._id}`).send({ parent: child._id }).expect(400)
  })

  it('is closed to a student session', async () => {
    await agent().get('/api/admin/taxonomy').expect(401)
  })
})

describe('published taxonomy on /api/config', () => {
  it('serves visible terms and withholds hidden ones', async () => {
    await makeTerm({ name: 'SEO', slug: 'seo', showInFilters: true })
    await makeTerm({ name: 'Secret', slug: 'secret', visibility: 'Hidden' })
    await makeTerm({ name: 'Unfinished', slug: 'unfinished', status: 'Draft' })

    const res = await agent().get('/api/config').expect(200)
    const names = (res.body.taxonomy?.topic || []).map((t) => t.name)

    expect(names).toContain('SEO')
    expect(names).not.toContain('Secret')
    expect(names).not.toContain('Unfinished')
  })

  it('carries the branding and menu settings the site renders from', async () => {
    const res = await agent().get('/api/config').expect(200)

    expect(res.body.branding.brandName).toBeTruthy()
    expect(res.body.menu).toHaveProperty('showWorkshops')
    expect(res.body.features).toHaveProperty('gamification')
  })
})

describe('catalogue filtering by the new facets', () => {
  it('filters by category and by tag', async () => {
    await paidCourse({ categories: ['Marketing'], tags: ['beginner'] })
    await paidCourse({ slug: 'other-course', categories: ['Design'], tags: ['advanced'] })

    const byCategory = await agent().get('/api/courses?category=Marketing').expect(200)
    expect(byCategory.body.items).toHaveLength(1)
    expect(byCategory.body.items[0].slug).toBe('seo-mastery')

    const byTag = await agent().get('/api/courses?tag=advanced').expect(200)
    expect(byTag.body.items).toHaveLength(1)
    expect(byTag.body.items[0].slug).toBe('other-course')
  })

  it('does not silently add the paid-only default when only a tag is given', async () => {
    await paidCourse({ slug: 'free-one', price: 'free', amount: 0, tags: ['starter'] })

    const res = await agent().get('/api/courses?tag=starter').expect(200)
    expect(res.body.items.map((c) => c.slug)).toContain('free-one')
  })
})

describe('homepage showcase rails', () => {
  it('builds a rail from a tag and fills it with what carries the tag', async () => {
    await paidCourse({ tags: ['Most popular'] })
    await Term.create({
      taxonomy: 'tag',
      name: 'Most popular',
      slug: 'most-popular',
      showAsRail: true,
      linkTo: '/courses',
    })

    const res = await agent().get('/api/showcase').expect(200)

    expect(res.body.rails).toHaveLength(1)
    expect(res.body.rails[0].name).toBe('Most popular')
    expect(res.body.rails[0].linkTo).toBe('/courses')
    expect(res.body.rails[0].items[0]).toMatchObject({ kind: 'course', slug: 'seo-mastery' })
  })

  it('omits a tag that is not flagged as a rail, and a rail with nothing in it', async () => {
    await paidCourse({ tags: ['Ordinary'] })
    await Term.create({ taxonomy: 'tag', name: 'Ordinary', slug: 'ordinary', showAsRail: false })
    await Term.create({ taxonomy: 'tag', name: 'Empty', slug: 'empty', showAsRail: true })

    const res = await agent().get('/api/showcase').expect(200)
    expect(res.body.rails).toHaveLength(0)
  })

  it('lists a tagged program alongside courses, programs first', async () => {
    await paidCourse({ tags: ['Flagship program'] })
    await Program.create({
      title: 'Complete Growth Marketing',
      slug: 'complete-growth-marketing',
      weeks: 12,
      tags: ['Flagship program'],
    })
    await Term.create({
      taxonomy: 'tag',
      name: 'Flagship program',
      slug: 'flagship-program',
      showAsRail: true,
    })

    const res = await agent().get('/api/showcase').expect(200)
    const items = res.body.rails[0].items

    expect(items[0]).toMatchObject({ kind: 'program', sub: '12-Week Program' })
    expect(items.map((i) => i.kind)).toContain('course')
  })

  it('falls back to the tag archive when no rail link is set', async () => {
    await paidCourse({ tags: ['Hot new releases'] })
    await Term.create({
      taxonomy: 'tag',
      name: 'Hot new releases',
      slug: 'hot-new-releases',
      showAsRail: true,
    })

    const res = await agent().get('/api/showcase').expect(200)
    expect(res.body.rails[0].linkTo).toBe('/courses?tag=Hot%20new%20releases')
  })

  it('keeps a draft course out of a rail', async () => {
    await paidCourse({ tags: ['Most popular'], status: 'Draft' })
    await Term.create({
      taxonomy: 'tag',
      name: 'Most popular',
      slug: 'most-popular',
      showAsRail: true,
    })

    const res = await agent().get('/api/showcase').expect(200)
    expect(res.body.rails).toHaveLength(0)
  })

  it('renaming a rail tag keeps its courses in the rail', async () => {
    const as = await adminAgent()
    await paidCourse({ tags: ['Most popular'] })
    const term = await Term.create({
      taxonomy: 'tag',
      name: 'Most popular',
      slug: 'most-popular',
      showAsRail: true,
    })

    await as('put', `/api/admin/taxonomy/${term._id}`).send({ name: 'Trending now' }).expect(200)

    const res = await agent().get('/api/showcase').expect(200)
    expect(res.body.rails[0].name).toBe('Trending now')
    expect(res.body.rails[0].items).toHaveLength(1)
  })
})

describe('program page copy', () => {
  it('serves the editable section copy and button labels', async () => {
    await Program.create({
      title: 'Complete Growth Marketing',
      slug: 'complete-growth-marketing',
      sectionCopy: [{ key: 'outcomes', heading: 'What you leave with' }],
      ctas: [{ key: 'heroApply', label: 'Join the cohort', to: '/signup' }],
    })

    const res = await agent().get('/api/programs/complete-growth-marketing').expect(200)

    expect(res.body.sectionCopy[0]).toMatchObject({
      key: 'outcomes',
      heading: 'What you leave with',
    })
    expect(res.body.ctas[0]).toMatchObject({ key: 'heroApply', label: 'Join the cohort' })
  })

  it('saves page copy through the admin tab without touching pricing', async () => {
    const as = await adminAgent()
    const program = await Program.create({
      title: 'Complete Growth Marketing',
      slug: 'complete-growth-marketing',
      pricing: { amount: 24999, note: 'Inclusive' },
    })

    await as('put', `/api/admin/programs/${program._id}/copy`)
      .send({
        sectionCopy: [{ key: 'cta', heading: 'Start shipping' }],
        ctas: [{ key: 'finalApply', label: 'Apply', to: '/signup' }],
        // Not a copy field — must be ignored rather than written.
        pricing: { amount: 1 },
      })
      .expect(200)

    const stored = await Program.findById(program._id)
    expect(stored.sectionCopy[0].heading).toBe('Start shipping')
    expect(stored.pricing.amount).toBe(24999)
  })

  it('is closed to anyone without an admin session', async () => {
    await agent().get('/api/admin/programs').expect(401)
  })
})

describe('course topics drive every surface that lists them', () => {
  const topic = (over = {}) =>
    Term.create({ taxonomy: 'topic', name: 'SEO', slug: 'seo', showInMenu: true, ...over })

  it('serves the short label the career banner uses', async () => {
    await topic({
      name: 'Social Advertising',
      slug: 'social-advertising',
      shortLabel: 'Social Ads',
      featured: true,
    })

    const res = await agent().get('/api/config').expect(200)
    const term = res.body.taxonomy.topic.find((t) => t.name === 'Social Advertising')

    expect(term).toMatchObject({ shortLabel: 'Social Ads', featured: true, showInMenu: true })
  })

  it('lets an admin add a topic that immediately appears to the public', async () => {
    const as = await adminAgent()

    await as('post', '/api/admin/taxonomy')
      .send({ taxonomy: 'topic', name: 'Marketing Automation', showInMenu: true })
      .expect(201)

    const res = await agent().get('/api/config').expect(200)
    expect(res.body.taxonomy.topic.map((t) => t.name)).toContain('Marketing Automation')
  })

  it('renames a topic across the courses that carry it and the public list', async () => {
    const as = await adminAgent()
    const course = await paidCourse({ topic: 'SEO' })
    const term = await topic()

    await as('put', `/api/admin/taxonomy/${term._id}`)
      .send({ name: 'Organic Search', shortLabel: 'Organic' })
      .expect(200)

    expect((await Course.findById(course._id)).topic).toBe('Organic Search')

    const res = await agent().get('/api/config').expect(200)
    const names = res.body.taxonomy.topic.map((t) => t.name)
    expect(names).toContain('Organic Search')
    expect(names).not.toContain('SEO')

    // The catalogue still finds the course under its new topic.
    const filtered = await agent().get('/api/courses?topic=Organic%20Search').expect(200)
    expect(filtered.body.items).toHaveLength(1)
  })

  it('deleting a topic in use still requires a decision about its courses', async () => {
    const as = await adminAgent()
    const course = await paidCourse({ topic: 'SEO' })
    const term = await topic()
    const replacement = await topic({ name: 'Organic', slug: 'organic' })

    await as('delete', `/api/admin/taxonomy/${term._id}`).expect(409)
    await as('delete', `/api/admin/taxonomy/${term._id}?replaceWith=${replacement._id}`).expect(200)

    expect((await Course.findById(course._id)).topic).toBe('Organic')
    const res = await agent().get('/api/config').expect(200)
    expect(res.body.taxonomy.topic.map((t) => t.name)).not.toContain('SEO')
  })

  it('withholds a topic hidden from the menu without deleting it', async () => {
    await topic({ showInMenu: false })

    const res = await agent().get('/api/config').expect(200)
    const term = res.body.taxonomy.topic.find((t) => t.name === 'SEO')
    // Still published and filterable, just not in the header or footer lists.
    expect(term).toMatchObject({ showInMenu: false, showInFilters: true })
  })
})
