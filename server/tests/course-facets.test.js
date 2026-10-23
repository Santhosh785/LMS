import { describe, expect, it } from 'vitest'
import { createCourse, listPublicFacets } from '../src/db/repos/courses.js'
import { agent } from './helpers/factories.js'

/**
 * The facets lookup the catalogue pages' loaders run, and the API route that
 * serves the same answer. Only public courses contribute values.
 */

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

describe('listPublicFacets', () => {
  it('returns the sorted distinct topics and languages of public courses only', async () => {
    await course('a', { topic: 'SEO', languages: ['Tamil', 'English'] })
    await course('b', { topic: 'PPC', languages: ['English'] })
    await course('c', { topic: 'Draft Topic', languages: ['Hindi'], status: 'Draft' })
    await course('d', { topic: 'Hidden Topic', languages: ['Telugu'], visibility: 'Hidden' })

    const facets = await listPublicFacets()
    expect(facets).toEqual({ topics: ['PPC', 'SEO'], languages: ['English', 'Tamil'] })

    const res = await agent().get('/api/courses/facets').expect(200)
    expect(res.body).toEqual(facets)
  })
})
