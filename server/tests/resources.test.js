import { describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { claudeSkills, emailContacts, playbooks } from '../src/db/schema/index.js'
import { countRows, insertRow, updateRow } from './helpers/content.js'
import { agent, signUpAdmin } from './helpers/factories.js'

/**
 * The Resources section: mentor playbooks and Claude skills.
 *
 * These are public marketing pages, so the load-bearing assertions are that a
 * draft never leaks, the filter row can only offer categories that exist, and
 * the cross-link between a playbook and its skill degrades rather than 404s.
 */

async function adminAgent() {
  const { cookie } = await signUpAdmin()
  return (method, url) => agent()[method](url).set('Cookie', cookie)
}

const makePlaybook = (over = {}) =>
  insertRow(playbooks, {
    title: 'The Intent-Map SEO Sprint',
    slug: 'intent-map-seo-sprint',
    cardTitle: 'Intent-map SEO sprint',
    tag: 'SEO',
    summary: 'From SERP scrape to shipped briefs.',
    authorName: 'Aravinth R.',
    sections: [{ id: 'the-market', heading: 'The market', body: ['Search moved.'] }],
    relatedSkill: { label: 'Intent map from SERP', slug: 'intent-map-from-serp' },
    status: 'Published',
    ...over,
  })

const makeSkill = (over = {}) =>
  insertRow(claudeSkills, {
    title: 'Intent Map From SERP Scrape',
    slug: 'intent-map-from-serp',
    category: 'seo',
    badge: 'SEO',
    summary: 'Turn top-10 results into content briefs.',
    features: [{ title: 'Scored sections', body: 'Each gets a status.' }],
    status: 'Published',
    ...over,
  })

describe('playbooks', () => {
  it('lists published playbooks with their tags', async () => {
    await makePlaybook()
    const res = await agent().get('/api/resources/playbooks').expect(200)
    expect(res.body.items).toHaveLength(1)
    expect(res.body.tags).toEqual(['SEO'])
    // The index card never needs the body, and these documents are large.
    expect(res.body.items[0].sections).toBeUndefined()
  })

  it('hides drafts from the index and from a direct slug hit', async () => {
    await makePlaybook({ status: 'Draft' })
    const list = await agent().get('/api/resources/playbooks').expect(200)
    expect(list.body.items).toHaveLength(0)
    await agent().get('/api/resources/playbooks/intent-map-seo-sprint').expect(404)
  })

  it('serves the full body on the detail route', async () => {
    await makePlaybook()
    const res = await agent().get('/api/resources/playbooks/intent-map-seo-sprint').expect(200)
    expect(res.body.sections[0].heading).toBe('The market')
  })

  /**
   * The sidebar cross-link is stored as a slug. If that skill is unpublished or
   * renamed the sidebar must render nothing rather than a link to a 404.
   */
  it('resolves the related skill, and drops it when unpublished', async () => {
    await makePlaybook()
    await makeSkill()

    const withSkill = await agent()
      .get('/api/resources/playbooks/intent-map-seo-sprint')
      .expect(200)
    expect(withSkill.body.relatedSkill.title).toBe('Intent Map From SERP Scrape')

    await updateRow(claudeSkills, 'slug', 'intent-map-from-serp', { status: 'Draft' })
    const without = await agent().get('/api/resources/playbooks/intent-map-seo-sprint').expect(200)
    expect(without.body.relatedSkill).toBeNull()
  })
})

describe('claude skills', () => {
  it('lists published skills and builds the filter row from what exists', async () => {
    await makeSkill()
    await makeSkill({
      slug: 'weekly-metrics',
      title: 'Weekly Metrics',
      category: 'analytics',
      badge: 'Analytics',
    })
    // Two skills share a category but badge differently — the filter must not split.
    await makeSkill({ slug: 'ai-traffic', title: 'AI Traffic', category: 'analytics', badge: 'AI' })

    const res = await agent().get('/api/resources/skills').expect(200)
    expect(res.body.items).toHaveLength(3)
    const analytics = res.body.categories.filter((c) => c.value === 'analytics')
    expect(analytics).toHaveLength(1)
    expect(analytics[0]).toMatchObject({ label: 'Analytics', count: 2 })
  })

  it('hides drafts and filters by category', async () => {
    await makeSkill()
    await makeSkill({ slug: 'hidden', title: 'Hidden', status: 'Draft' })
    const res = await agent().get('/api/resources/skills?category=seo').expect(200)
    expect(res.body.items).toHaveLength(1)
    await agent().get('/api/resources/skills/hidden').expect(404)
  })
})

describe('playbook notify', () => {
  it('subscribes an email once, however many times it is submitted', async () => {
    await agent().post('/api/resources/notify').send({ email: 'reader@example.in' }).expect(201)
    await agent().post('/api/resources/notify').send({ email: 'reader@example.in' }).expect(201)
    expect(await countRows(emailContacts, eq(emailContacts.email, 'reader@example.in'))).toBe(1)
  })

  it('rejects an invalid address', async () => {
    await agent().post('/api/resources/notify').send({ email: 'nope' }).expect(400)
  })
})

describe('resources admin', () => {
  it('stays behind the admin role', async () => {
    await agent().get('/api/admin/playbooks').expect(401)
    await agent().get('/api/admin/skills').expect(401)
  })

  it('derives a slug from the title on create', async () => {
    const as = await adminAgent()
    const res = await as('post', '/api/admin/playbooks')
      .send({ title: 'A Brand New Playbook' })
      .expect(201)
    expect(res.body.slug).toBe('a-brand-new-playbook')
  })

  it('refuses a slug another entry already uses', async () => {
    await makePlaybook()
    const as = await adminAgent()
    await as('post', '/api/admin/playbooks')
      .send({ title: 'Another', slug: 'intent-map-seo-sprint' })
      .expect(400)
  })

  /** Reordering is the whole reason an operator opens this screen. */
  it('reorders playbooks by id', async () => {
    const a = await makePlaybook({ slug: 'first', title: 'First', order: 0 })
    const b = await makePlaybook({ slug: 'second', title: 'Second', order: 1 })
    const as = await adminAgent()

    await as('put', '/api/admin/playbooks/reorder')
      .send({ ids: [b._id.toString(), a._id.toString()] })
      .expect(200)

    const res = await agent().get('/api/resources/playbooks').expect(200)
    expect(res.body.items.map((p) => p.slug)).toEqual(['second', 'first'])
  })

  it('rejects an empty reorder', async () => {
    const as = await adminAgent()
    await as('put', '/api/admin/skills/reorder').send({ ids: [] }).expect(400)
  })
})
