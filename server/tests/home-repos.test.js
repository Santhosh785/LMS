import { describe, expect, it } from 'vitest'
import { workshops } from '../src/db/schema/index.js'
import { listWorkshopCards } from '../src/db/repos/workshops.js'
import { agent } from './helpers/factories.js'
import { insertRow } from './helpers/content.js'

/**
 * The home route's workshop preview (client/src/routes/public/home.ts) reads
 * `listWorkshopCards` in-process instead of GET /api/workshops. It must pick
 * the same workshops the page showed when it sliced the API list, and carry
 * only the card's columns.
 */

const CARD_KEYS = [
  'bannerClass',
  'durationLabel',
  'image',
  'language',
  'mode',
  'priceNew',
  'slug',
  'title',
  'venue',
]

describe('listWorkshopCards', () => {
  it('returns the first workshops in the order GET /api/workshops lists them', async () => {
    await insertRow(workshops, {
      title: 'Tamil late',
      slug: 'ta-late',
      language: 'Tamil',
      startsAt: new Date('2030-03-01'),
    })
    await insertRow(workshops, {
      title: 'Tamil early',
      slug: 'ta-early',
      language: 'Tamil',
      startsAt: new Date('2030-01-01'),
    })
    await insertRow(workshops, {
      title: 'English',
      slug: 'en',
      language: 'English',
      startsAt: new Date('2030-02-01'),
    })
    await insertRow(workshops, {
      title: 'No language',
      slug: 'none',
      mode: 'offline',
      venue: 'Chennai',
    })

    const api = await agent().get('/api/workshops').expect(200)
    const expected = api.body.items.slice(0, 3).map((w) => w.slug)

    const rows = await listWorkshopCards(3)
    expect(rows.map((w) => w.slug)).toEqual(expected)
    expect(expected).toEqual(['none', 'en', 'ta-early'])
    for (const row of rows) expect(Object.keys(row).sort()).toEqual(CARD_KEYS)
  })

  it('returns an empty list when there are no workshops', async () => {
    expect(await listWorkshopCards(3)).toEqual([])
  })
})
