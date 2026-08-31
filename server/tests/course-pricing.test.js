import { describe, expect, it } from 'vitest'
import { Course } from '../src/models/index.js'
import { agent, paidCourse, signUpAdmin } from './helpers/factories.js'

/**
 * `price` (the paid/free classification) and `amount` describe one fact, and
 * the admin UI used to be able to move one without the other.
 *
 * The symptom was quiet: a course created at ₹0 stayed classified `paid`, its
 * catalogue card rendered "Free" (the card reads `amount`), and the homepage's
 * Free Courses tab (which reads `price`) never listed it. Nothing errored — the
 * course was simply invisible where the operator expected it.
 */

async function adminAgent() {
  const { cookie } = await signUpAdmin()
  return (method, url) => agent()[method](url).set('Cookie', cookie)
}

describe('price and amount stay consistent', () => {
  it('creates a ₹0 course as free, not paid', async () => {
    const as = await adminAgent()

    const res = await as('post', '/api/admin/courses')
      .send({ title: 'Free Intro', slug: 'free-intro', amount: 0, status: 'Published' })
      .expect(201)

    expect(res.body.price).toBe('free')
  })

  it('creates a priced course as paid', async () => {
    const as = await adminAgent()

    const res = await as('post', '/api/admin/courses')
      .send({ title: 'Paid Course', slug: 'paid-course', amount: 1999 })
      .expect(201)

    expect(res.body.price).toBe('paid')
  })

  it('flips to free when the amount is dropped to zero', async () => {
    const as = await adminAgent()
    const course = await paidCourse()

    await as('put', `/api/admin/courses/${course._id}/pricing`).send({ amount: 0 }).expect(200)
    expect((await Course.findById(course._id)).price).toBe('free')
  })

  it('flips to paid when an amount is put back on', async () => {
    const as = await adminAgent()
    const course = await paidCourse({ price: 'free', amount: 0 })

    await as('put', `/api/admin/courses/${course._id}/pricing`).send({ amount: 499 }).expect(200)
    expect((await Course.findById(course._id)).price).toBe('paid')
  })

  it('zeroes the amount when the flag alone is set to free', async () => {
    const as = await adminAgent()
    const course = await paidCourse({ amount: 2499 })

    await as('put', `/api/admin/courses/${course._id}/pricing`).send({ price: 'free' }).expect(200)

    const stored = await Course.findById(course._id)
    expect(stored.price).toBe('free')
    expect(stored.amount).toBe(0)
  })

  it('takes the amount as the truth when the two disagree', async () => {
    const as = await adminAgent()
    const course = await paidCourse()

    await as('put', `/api/admin/courses/${course._id}/pricing`)
      .send({ price: 'free', amount: 999 })
      .expect(200)

    expect((await Course.findById(course._id)).price).toBe('paid')
  })

  it('leaves pricing alone when a save touches neither field', async () => {
    const as = await adminAgent()
    const course = await paidCourse({ amount: 2499 })

    await as('put', `/api/admin/courses/${course._id}/settings`)
      .send({ title: 'Renamed' })
      .expect(200)

    const stored = await Course.findById(course._id)
    expect(stored.price).toBe('paid')
    expect(stored.amount).toBe(2499)
  })

  it('makes a free course reachable through the free facet', async () => {
    const as = await adminAgent()
    await as('post', '/api/admin/courses')
      .send({
        title: 'Free Intro',
        slug: 'free-intro',
        amount: 0,
        status: 'Published',
        visibility: 'Public',
      })
      .expect(201)

    const res = await agent().get('/api/courses?price=free').expect(200)
    expect(res.body.items.map((c) => c.slug)).toContain('free-intro')
  })
})
