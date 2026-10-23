import { afterAll, describe, expect, it, vi } from 'vitest'
import { pool } from '../src/db/index.js'
import { getSiteConfig } from '../src/services/siteConfig.js'
import { CHANNEL, createInvalidationListener } from '../src/services/invalidation.js'

/**
 * The real LISTEN/NOTIFY round trip against the test database.
 *
 * LISTEN needs a session, so this only runs when a session-capable URL is
 * configured (BOSS_DATABASE_URL or DIRECT_DATABASE_URL). The notification is
 * sent with a bare pg_notify through the app pool — not invalidateEverywhere,
 * which would clear the cache locally first and prove nothing.
 */
const sessionUrl = process.env.BOSS_DATABASE_URL || process.env.DIRECT_DATABASE_URL

const notify = (payload) => pool.query('select pg_notify($1, $2)', [CHANNEL, payload])

/**
 * Primes the site config cache and returns the cached promise — wrapped, since
 * an async function would otherwise unwrap it into the payload.
 */
async function primedSiteConfig() {
  const cached = getSiteConfig()
  await cached
  expect(getSiteConfig()).toBe(cached)
  return { cached }
}

describe.skipIf(!sessionUrl)('invalidation listener (live database)', () => {
  const quiet = { log: () => {}, warn: () => {}, debug: () => {}, error: () => {} }
  const listener = createInvalidationListener({ connectionString: sessionUrl, logger: quiet })

  afterAll(() => listener.stop())

  it('a notification clears the local site config cache', async () => {
    await listener.start()
    expect(listener.state).toBe('connected')

    const { cached: before } = await primedSiteConfig()
    await notify(JSON.stringify({ scope: 'siteConfig' }))
    // A cleared cache hands out a new promise; a warm one keeps returning the old.
    await vi.waitFor(() => expect(getSiteConfig()).not.toBe(before), {
      timeout: 2_000,
      interval: 25,
    })
  })

  it('malformed payloads on the channel are ignored and the listener stays up', async () => {
    const { cached: before } = await primedSiteConfig()
    await notify('not json')
    await notify(JSON.stringify({ scope: 'nope' }))
    await new Promise((r) => setTimeout(r, 500))
    expect(getSiteConfig()).toBe(before)
    expect(listener.state).toBe('connected')
  })

  it('recovers when its backend is terminated, re-issues LISTEN and receives again', async () => {
    const { rows } = await listener.client.query('select pg_backend_pid() as pid')
    const oldPid = rows[0].pid
    await pool.query('select pg_terminate_backend($1)', [oldPid])

    await vi.waitFor(() => expect(listener.state).not.toBe('connected'), { timeout: 5_000 })
    // First retry is after 1s; allow for a slow remote connect.
    await vi.waitFor(() => expect(listener.state).toBe('connected'), {
      timeout: 15_000,
      interval: 100,
    })
    const again = await listener.client.query('select pg_backend_pid() as pid')
    expect(again.rows[0].pid).not.toBe(oldPid)

    const { cached: before } = await primedSiteConfig()
    await notify(JSON.stringify({ scope: 'all' }))
    await vi.waitFor(() => expect(getSiteConfig()).not.toBe(before), {
      timeout: 2_000,
      interval: 25,
    })
  }, 30_000)
})
