import { describe, expect, it } from 'vitest'
import { Program } from '../src/models/index.js'
import { agent, signUpAdmin } from './helpers/factories.js'

/**
 * The flagship page's 2026 redesign sections.
 *
 * The page is entirely data-driven: every section renders only when the Program
 * document carries its field, so a field silently dropped by the admin route's
 * whitelist takes a whole section off a live sales page with no error anywhere.
 * These tests pin the round-trip and the two behaviours the page depends on.
 */

async function adminAgent() {
  const { cookie } = await signUpAdmin()
  return (method, url) => agent()[method](url).set('Cookie', cookie)
}

const baseProgram = (over = {}) => ({
  title: 'Complete Growth Marketing Course',
  slug: 'complete-growth-marketing',
  ...over,
})

describe('program redesign sections', () => {
  it('serves the new sections on the public endpoint', async () => {
    await Program.create(
      baseProgram({
        batchNote: 'Batch 4 open · 10 seats per batch',
        trustBar: [{ value: '42 hrs', label: 'AI-native Common Core' }],
        why: { paragraphs: ['Marketing changed twice in three years.'], image: '/x.jpg' },
        structure: {
          columns: ['Stage', 'Business owners', 'Freshers & freelancers'],
          rows: [{ stage: 'Common Core', values: ['Weeks 1–6 · 42 hours'] }],
        },
        tracks: [{ tag: 'Track A', title: 'Business owners', modules: [{ code: 'A1', body: 'x' }] }],
        toolGroups: [{ title: 'Paid media', items: ['Meta Ads Manager'] }],
        pricing: { amount: 79999, funding: [{ title: 'Common Core', body: 'Weeks 1–6' }] },
      }),
    )

    const res = await agent().get('/api/programs/complete-growth-marketing').expect(200)
    expect(res.body.batchNote).toBe('Batch 4 open · 10 seats per batch')
    expect(res.body.trustBar).toHaveLength(1)
    expect(res.body.why.paragraphs[0]).toMatch(/changed twice/)
    expect(res.body.structure.rows[0].values).toEqual(['Weeks 1–6 · 42 hours'])
    expect(res.body.tracks[0].modules[0].code).toBe('A1')
    expect(res.body.toolGroups[0].items).toEqual(['Meta Ads Manager'])
    expect(res.body.pricing.funding[0].title).toBe('Common Core')
  })

  /**
   * The admin saves per tab against a field whitelist. A new field missing from
   * that list is dropped silently — the request still returns 200 — so this
   * asserts the values come back, not just the status code.
   */
  it('round-trips the batch note through the information tab', async () => {
    const program = await Program.create(baseProgram())
    const as = await adminAgent()

    await as('put', `/api/admin/programs/${program._id}/information`)
      .send({ title: 'Complete Growth Marketing Course', batchNote: 'Batch 5 open · 8 seats left' })
      .expect(200)

    const saved = await Program.findById(program._id).lean()
    expect(saved.batchNote).toBe('Batch 5 open · 8 seats left')
  })

  it('round-trips the redesign content sections and the pricing panel', async () => {
    const program = await Program.create(baseProgram())
    const as = await adminAgent()

    await as('put', `/api/admin/programs/${program._id}/content`)
      .send({
        trustBar: [{ value: '78–92 hrs', label: 'total by track' }],
        why: { paragraphs: ['One', 'Two'], brochureUrl: 'https://example.com/b.pdf' },
        structure: { columns: ['Stage', 'A', 'B'], rows: [{ stage: 'Total', values: ['1', '2'], isTotal: true }] },
        tracks: [{ tag: 'Track B', title: 'Freelancers', milestone: 'Client delivery' }],
        toolGroups: [{ title: 'SEO', items: ['GA4', 'Search Console'] }],
      })
      .expect(200)

    await as('put', `/api/admin/programs/${program._id}/pricing`)
      .send({
        pricing: {
          amount: 79999,
          currency: 'INR',
          taxNote: '/– (inc. tax)',
          scholarship: 'flat ₹10,000 scholarship',
          status: 'Batch 4 open',
          slots: '10 seats per cohort',
          funding: [{ title: 'Mentor reviews', body: 'Weekly 1:1' }],
        },
      })
      .expect(200)

    const saved = await Program.findById(program._id).lean()
    expect(saved.trustBar[0].value).toBe('78–92 hrs')
    expect(saved.why.paragraphs).toEqual(['One', 'Two'])
    expect(saved.structure.rows[0].isTotal).toBe(true)
    expect(saved.tracks[0].milestone).toBe('Client delivery')
    expect(saved.toolGroups[0].items).toEqual(['GA4', 'Search Console'])
    expect(saved.pricing).toMatchObject({
      currency: 'INR',
      scholarship: 'flat ₹10,000 scholarship',
      slots: '10 seats per cohort',
    })
    expect(saved.pricing.funding[0]).toMatchObject({ title: 'Mentor reviews', body: 'Weekly 1:1' })
  })

  /** A program from before the redesign must keep working, just with fewer sections. */
  it('leaves a program without the new fields untouched', async () => {
    await Program.create(
      baseProgram({ slug: 'legacy-program', pricing: { amount: 49999, benefits: ['Live sessions'] } }),
    )

    const res = await agent().get('/api/programs/legacy-program').expect(200)
    expect(res.body.pricing.benefits).toEqual(['Live sessions'])
    expect(res.body.tracks ?? []).toHaveLength(0)
    expect(res.body.toolGroups ?? []).toHaveLength(0)
  })
})
