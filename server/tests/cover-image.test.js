import { describe, expect, it } from 'vitest'
import { BlogPost, Course, Term, Workshop } from '../src/models/index.js'
import { agent, paidCourse, signUpAdmin } from './helpers/factories.js'

/**
 * Optional cover images (the design ships with coloured gradient blocks).
 *
 * The contract is that an image is purely additive: content without one keeps
 * rendering exactly as before, so adding the field cannot regress a page that
 * nobody has set an image on.
 */

async function adminAgent() {
  const { cookie } = await signUpAdmin()
  return (method, url) => agent()[method](url).set('Cookie', cookie)
}

describe('course cover image', () => {
  it('saves through the information tab', async () => {
    const as = await adminAgent()
    const course = await paidCourse()

    await as('put', `/api/admin/courses/${course._id}/settings`)
      .send({ image: 'https://cdn.example.com/seo.jpg', imageAlt: 'An SEO dashboard' })
      .expect(200)

    const stored = await Course.findById(course._id)
    expect(stored.image).toBe('https://cdn.example.com/seo.jpg')
    expect(stored.imageAlt).toBe('An SEO dashboard')
  })

  it('reaches the public course page and the catalogue', async () => {
    await paidCourse({ image: 'https://cdn.example.com/seo.jpg', imageAlt: 'Alt text' })

    const detail = await agent().get('/api/courses/seo-mastery').expect(200)
    expect(detail.body.image).toBe('https://cdn.example.com/seo.jpg')
    expect(detail.body.imageAlt).toBe('Alt text')

    const list = await agent().get('/api/courses?price=paid').expect(200)
    expect(list.body.items[0].image).toBe('https://cdn.example.com/seo.jpg')
  })

  it('keeps the gradient class alongside it as the fallback', async () => {
    await paidCourse({ image: 'https://cdn.example.com/seo.jpg', thumbClass: 'media-seo' })

    const res = await agent().get('/api/courses/seo-mastery').expect(200)
    expect(res.body.thumbClass).toBe('media-seo')
  })

  it('is absent, not empty-string, on content that never set one', async () => {
    await paidCourse()
    const res = await agent().get('/api/courses/seo-mastery').expect(200)
    expect(res.body.image).toBeUndefined()
  })

  it('travels with a course into a homepage rail', async () => {
    await paidCourse({ tags: ['Most popular'], image: 'https://cdn.example.com/seo.jpg' })
    await Term.create({
      taxonomy: 'tag',
      name: 'Most popular',
      slug: 'most-popular',
      showAsRail: true,
    })

    const res = await agent().get('/api/showcase').expect(200)
    expect(res.body.rails[0].items[0].image).toBe('https://cdn.example.com/seo.jpg')
  })
})

describe('workshop and blog cover images', () => {
  it('serves a workshop image', async () => {
    await Workshop.create({
      title: 'SEO Live',
      slug: 'seo-live',
      image: 'https://cdn.example.com/ws.jpg',
    })

    const res = await agent().get('/api/workshops/seo-live').expect(200)
    expect(res.body.image).toBe('https://cdn.example.com/ws.jpg')
  })

  it('serves a blog post image', async () => {
    await BlogPost.create({
      title: 'A post',
      slug: 'a-post',
      category: 'SEO',
      image: 'https://cdn.example.com/post.jpg',
      // The public endpoint only serves published posts; this test is about the
      // cover image, so the fixture has to be one.
      status: 'Published',
    })

    const res = await agent().get('/api/blog/a-post').expect(200)
    expect(res.body.post?.image ?? res.body.image).toBe('https://cdn.example.com/post.jpg')
  })
})
