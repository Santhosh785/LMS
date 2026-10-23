import { describe, expect, it } from 'vitest'
import { publicCache } from '../src/middleware/cacheControl.js'
import { agent } from './helpers/factories.js'

describe('publicCache', () => {
  it('is cacheable at the edge, stale for a day, for an anonymous visitor', () => {
    expect(publicCache(60, false)).toBe('public, s-maxage=60, stale-while-revalidate=86400')
    expect(publicCache(300, false)).toBe('public, s-maxage=300, stale-while-revalidate=86400')
  })

  it('is private and never stored for a signed-in visitor', () => {
    expect(publicCache(60, true)).toBe('private, no-store')
  })
})

describe('Cache-Control on /api', () => {
  it('defaults every API response to no-store', async () => {
    const health = await agent().get('/api/health')
    expect(health.headers['cache-control']).toBe('no-store')

    const missing = await agent().get('/api/no-such-route')
    expect(missing.status).toBe(404)
    expect(missing.headers['cache-control']).toBe('no-store')
  })

  it('lets /api/config override it with a one-minute shared cache', async () => {
    const res = await agent().get('/api/config')
    expect(res.status).toBe(200)
    expect(res.headers['cache-control']).toBe('public, s-maxage=60')
  })
})
