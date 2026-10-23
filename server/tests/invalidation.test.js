import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import {
  CHANNEL,
  INSTANCE_ID,
  applyInvalidation,
  createInvalidationListener,
  handleNotification,
  invalidateEverywhere,
  parseInvalidation,
} from '../src/services/invalidation.js'
import { assertReplicaSafe, parseReplicas } from '../src/config/replicas.js'

/**
 * Cross-instance cache invalidation (task 6). Everything here runs without a
 * database: the dispatch is a pure function of the payload, and the listener's
 * reconnect loop is driven with a fake client and a hand-cranked timer. The
 * real LISTEN/NOTIFY round trip is in invalidation-listener.test.js.
 */

const quietLogger = () => ({ log: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() })

function spyHandlers() {
  const calls = []
  return {
    calls,
    logger: quietLogger(),
    invalidateSiteConfig: vi.fn(() => calls.push('site')),
    invalidateRuntimeConfig: vi.fn(() => calls.push('runtime-stale')),
    refreshRuntimeConfig: vi.fn(async () => calls.push('runtime-refresh')),
    invalidateSitemap: vi.fn(() => calls.push('sitemap')),
  }
}

describe('notification dispatch', () => {
  it('siteConfig clears only the site config cache', async () => {
    const h = spyHandlers()
    expect(handleNotification(JSON.stringify({ scope: 'siteConfig' }), h)).toBe('siteConfig')
    await Promise.resolve()
    expect(h.calls).toEqual(['site'])
  })

  it('runtimeConfig marks the runtime config stale and refreshes it in the background', async () => {
    const h = spyHandlers()
    expect(handleNotification(JSON.stringify({ scope: 'runtimeConfig' }), h)).toBe('runtimeConfig')
    await vi.waitFor(() => expect(h.refreshRuntimeConfig).toHaveBeenCalledTimes(1))
    expect(h.calls).toEqual(['runtime-stale', 'runtime-refresh'])
    expect(h.invalidateSiteConfig).not.toHaveBeenCalled()
  })

  it('all does every scope, and clears the site config again once the new flags are loaded', async () => {
    const h = spyHandlers()
    await applyInvalidation('all', h)
    expect(h.calls).toEqual(['sitemap', 'site', 'runtime-stale', 'runtime-refresh', 'site'])
  })

  it('sitemap clears only the sitemap memo', async () => {
    const h = spyHandlers()
    expect(handleNotification(JSON.stringify({ scope: 'sitemap' }), h)).toBe('sitemap')
    await Promise.resolve()
    expect(h.calls).toEqual(['sitemap'])
    expect(h.invalidateSiteConfig).not.toHaveBeenCalled()
    expect(h.invalidateRuntimeConfig).not.toHaveBeenCalled()
  })

  it('sitemap clears the real memo by default', async () => {
    const sitemap = await import('../src/services/sitemap.js')
    // A warm memo hands out the same promise; a cleared one builds a new one.
    const memo = sitemap.getSitemap()
    try {
      expect(sitemap.getSitemap()).toBe(memo)
      handleNotification(JSON.stringify({ scope: 'sitemap' }), { logger: quietLogger() })
      expect(sitemap.getSitemap()).not.toBe(memo)
    } finally {
      await Promise.allSettled([memo, sitemap.getSitemap()])
      sitemap.invalidateSitemap()
    }
  })

  it('skips a notification this process published, and applies anyone else’s', async () => {
    const h = spyHandlers()
    const own = JSON.stringify({ scope: 'siteConfig', origin: INSTANCE_ID })
    expect(handleNotification(own, h)).toBeNull()
    expect(h.invalidateSiteConfig).not.toHaveBeenCalled()

    const other = JSON.stringify({ scope: 'siteConfig', origin: 'another-instance' })
    expect(handleNotification(other, h)).toBe('siteConfig')
    expect(h.invalidateSiteConfig).toHaveBeenCalledTimes(1)
  })

  it('ignores malformed JSON at low severity without throwing', () => {
    const h = spyHandlers()
    for (const bad of ['not json', '{', '', undefined, null, '"just a string"', '42', '[]']) {
      expect(handleNotification(bad, h)).toBeNull()
    }
    expect(h.invalidateSiteConfig).not.toHaveBeenCalled()
    expect(h.invalidateRuntimeConfig).not.toHaveBeenCalled()
    expect(h.logger.warn).not.toHaveBeenCalled()
    expect(h.logger.error).not.toHaveBeenCalled()
    expect(h.logger.debug).toHaveBeenCalled()
  })

  it('ignores unknown scopes', () => {
    const h = spyHandlers()
    for (const scope of ['everything', 'SITECONFIG', 'Sitemap', '', 7, null]) {
      expect(handleNotification(JSON.stringify({ scope }), h)).toBeNull()
    }
    expect(handleNotification(JSON.stringify({}), h)).toBeNull()
    expect(parseInvalidation(JSON.stringify({ scope: 'all' }), h.logger)).toBe('all')
    expect(h.invalidateSiteConfig).not.toHaveBeenCalled()
    expect(h.logger.debug).toHaveBeenCalled()
  })

  it('a refresh that rejects is contained', async () => {
    const h = spyHandlers()
    h.refreshRuntimeConfig = vi.fn(async () => {
      throw new Error('db down')
    })
    await expect(applyInvalidation('all', h)).resolves.toBeUndefined()
    expect(h.invalidateSiteConfig).toHaveBeenCalledTimes(2)
  })
})

describe('invalidateEverywhere', () => {
  it('clears locally first, then publishes the scope', async () => {
    const h = spyHandlers()
    const publish = vi.fn(async () => h.calls.push('publish'))
    await invalidateEverywhere('siteConfig', { ...h, publish })
    expect(h.calls).toEqual(['site', 'publish'])
    expect(JSON.parse(publish.mock.calls[0][0])).toEqual({
      scope: 'siteConfig',
      origin: INSTANCE_ID,
    })
  })

  it('broadcasts the sitemap scope', async () => {
    const h = spyHandlers()
    const publish = vi.fn(async () => h.calls.push('publish'))
    await invalidateEverywhere('sitemap', { ...h, publish })
    expect(h.calls).toEqual(['sitemap', 'publish'])
    expect(JSON.parse(publish.mock.calls[0][0]).scope).toBe('sitemap')
  })

  it('rejects an unknown scope', async () => {
    await expect(invalidateEverywhere('nope', { publish: vi.fn() })).rejects.toThrow(/Unknown/)
  })

  it('waits for the local runtime refresh before publishing', async () => {
    const h = spyHandlers()
    const publish = vi.fn(async () => h.calls.push('publish'))
    await invalidateEverywhere('all', { ...h, publish })
    expect(h.calls).toEqual([
      'sitemap',
      'site',
      'runtime-stale',
      'runtime-refresh',
      'site',
      'publish',
    ])
  })

  it('swallows and logs a failed publish', async () => {
    const h = spyHandlers()
    const publish = vi.fn(async () => {
      throw new Error('connection refused')
    })
    await expect(invalidateEverywhere('all', { ...h, publish })).resolves.toBeUndefined()
    expect(h.invalidateSiteConfig).toHaveBeenCalled()
    expect(h.logger.warn).toHaveBeenCalledWith(expect.stringContaining('connection refused'))
  })

  it('publishes through the normal pool by default', async () => {
    const { pool } = await import('../src/db/index.js')
    const query = vi.spyOn(pool, 'query').mockResolvedValueOnce({ rows: [] })
    try {
      await invalidateEverywhere('siteConfig')
      expect(query).toHaveBeenCalledWith('select pg_notify($1, $2)', [
        CHANNEL,
        JSON.stringify({ scope: 'siteConfig', origin: INSTANCE_ID }),
      ])
    } finally {
      query.mockRestore()
    }
  })
})

/* ------------------------------ the listener ------------------------------ */

/**
 * A stand-in for pg.Client. `outcomes` decides, attempt by attempt, whether
 * connect() succeeds; a connected client can be killed to simulate the backend
 * being terminated.
 */
function fakeClients(outcomes) {
  const made = []
  const createClient = (connectionString) => {
    const ok = outcomes.length ? outcomes.shift() : true
    const c = new EventEmitter()
    c.connectionString = connectionString
    c.queries = []
    c.connect = async () => {
      if (!ok) throw new Error('ECONNREFUSED')
    }
    c.query = async (text) => {
      c.queries.push(text)
    }
    c.end = async () => {
      c.ended = true
    }
    c.kill = () => {
      c.emit('error', new Error('terminating connection due to administrator command'))
      c.emit('end')
    }
    made.push(c)
    return c
  }
  return { made, createClient }
}

/** A timer queue the test advances by hand, recording every requested delay. */
function manualTimers() {
  const delays = []
  let pending = null
  return {
    delays,
    setTimer: (fn, ms) => {
      delays.push(ms)
      pending = fn
      return { unref() {} }
    },
    clearTimer: () => {
      pending = null
    },
    async fire() {
      const fn = pending
      pending = null
      fn()
    },
    get pending() {
      return pending !== null
    },
  }
}

function listenerWith(outcomes, extra = {}) {
  const clients = fakeClients(outcomes)
  const timers = manualTimers()
  const logger = quietLogger()
  const listener = createInvalidationListener({
    connectionString: 'postgres://session-capable/db',
    createClient: clients.createClient,
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
    logger,
    ...extra,
  })
  return { listener, clients, timers, logger }
}

describe('invalidation listener', () => {
  it('connects, issues LISTEN and forwards notifications on its channel only', async () => {
    const onNotification = vi.fn()
    const { listener, clients, logger } = listenerWith([true], { onNotification })
    await listener.start()

    expect(listener.state).toBe('connected')
    expect(clients.made[0].queries).toEqual([`LISTEN ${CHANNEL}`])
    expect(logger.log).toHaveBeenCalledTimes(1)

    clients.made[0].emit('notification', { channel: CHANNEL, payload: '{"scope":"all"}' })
    clients.made[0].emit('notification', { channel: 'other', payload: '{"scope":"all"}' })
    expect(onNotification).toHaveBeenCalledTimes(1)
    expect(onNotification).toHaveBeenCalledWith('{"scope":"all"}')
    await listener.stop()
  })

  it('a handler that throws does not break the listener', async () => {
    const onNotification = vi.fn(() => {
      throw new Error('boom')
    })
    const { listener, clients } = listenerWith([true], { onNotification })
    await listener.start()
    expect(() =>
      clients.made[0].emit('notification', { channel: CHANNEL, payload: 'x' }),
    ).not.toThrow()
    expect(listener.state).toBe('connected')
    await listener.stop()
  })

  it('backs off 1s, 2s, 4s … capped at 30s, logging the outage once, not per attempt', async () => {
    const { listener, timers, logger } = listenerWith(Array(9).fill(false))
    await listener.start() // the boot attempt fails; the server carries on

    expect(listener.state).toBe('lost')
    for (let i = 0; i < 8; i++) {
      await timers.fire()
      await listener.settled
    }
    expect(timers.delays).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000, 30000])
    expect(listener.state).toBe('reconnecting')
    // One "could not connect", one "reconnecting" — nine failed attempts.
    expect(logger.warn).toHaveBeenCalledTimes(1)
    expect(logger.log).toHaveBeenCalledTimes(1)
    await listener.stop()
  })

  it('resets the backoff after a successful connection and re-issues LISTEN', async () => {
    const { listener, clients, timers, logger } = listenerWith([false, false, false, true])
    await listener.start()
    for (let i = 0; i < 3; i++) {
      await timers.fire()
      await listener.settled
    }
    expect(listener.state).toBe('connected')
    expect(timers.delays).toEqual([1000, 2000, 4000])

    // The backend is terminated: lost, then reconnect starting at 1s again.
    clients.made[3].kill()
    expect(listener.state).toBe('lost')
    await timers.fire()
    await listener.settled
    expect(timers.delays).toEqual([1000, 2000, 4000, 1000])
    expect(listener.state).toBe('connected')
    expect(clients.made[4].queries).toEqual([`LISTEN ${CHANNEL}`])

    const transitions = [...logger.log.mock.calls, ...logger.warn.mock.calls].map((c) => c[0])
    expect(transitions.filter((m) => m.includes('listening on'))).toHaveLength(2)
    expect(transitions.filter((m) => m.includes('connection lost'))).toHaveLength(1)
    expect(transitions.filter((m) => m.includes('reconnecting'))).toHaveLength(2)
    await listener.stop()
  })

  it('a duplicate error and end for one drop schedules a single retry', async () => {
    const { listener, clients, timers } = listenerWith([true])
    await listener.start()
    clients.made[0].kill()
    clients.made[0].emit('error', new Error('again'))
    expect(timers.delays).toEqual([1000])
    await listener.stop()
  })

  it('stop() closes the connection and cancels a pending retry', async () => {
    const a = listenerWith([true])
    await a.listener.start()
    await a.listener.stop()
    expect(a.clients.made[0].ended).toBe(true)
    a.clients.made[0].emit('end')
    expect(a.timers.pending).toBe(false)

    const b = listenerWith([false])
    await b.listener.start()
    expect(b.timers.pending).toBe(true)
    await b.listener.stop()
    expect(b.timers.pending).toBe(false)
  })

  it('without a session-capable URL it stays off and the server keeps its TTLs', async () => {
    const { listener, clients, logger } = listenerWith([], { connectionString: '' })
    await listener.start()
    expect(clients.made).toHaveLength(0)
    expect(logger.warn).toHaveBeenCalledTimes(1)
  })
})

describe('replica guard', () => {
  it('REPLICAS defaults to 1, and invalid or non-numeric values fall back to 1', () => {
    for (const value of [
      undefined,
      null,
      '',
      '  ',
      'two',
      '0',
      '-2',
      '1.5',
      '2abc',
      'NaN',
      '1e3',
    ]) {
      expect(parseReplicas(value)).toBe(1)
    }
    expect(parseReplicas('1')).toBe(1)
    expect(parseReplicas('2')).toBe(2)
    expect(parseReplicas(' 3 ')).toBe(3)
  })

  it('refuses more than one replica without Bunny Storage, naming the problem', () => {
    expect(() => assertReplicaSafe({ replicas: 2, storageConfigured: false })).toThrow(
      /REPLICAS=2.*Bunny Storage is not configured.*local disk.*not shared/s,
    )
  })

  it('allows several replicas with Bunny Storage, and one replica without it', () => {
    expect(() => assertReplicaSafe({ replicas: 2, storageConfigured: true })).not.toThrow()
    expect(() => assertReplicaSafe({ replicas: 1, storageConfigured: false })).not.toThrow()
    expect(() =>
      assertReplicaSafe({ replicas: parseReplicas(undefined), storageConfigured: false }),
    ).not.toThrow()
  })

  it('uses the same storage check as the media routes', async () => {
    const { env } = await import('../src/config/env.js')
    const { isBunnyStorageConfigured } = await import('../src/services/bunnyStorage.js')
    // tests/setup.js blanks the BUNNY_STORAGE_* variables.
    expect(isBunnyStorageConfigured()).toBe(false)
    expect(env.replicas).toBe(parseReplicas(process.env.REPLICAS))
    expect(() =>
      assertReplicaSafe({ replicas: 2, storageConfigured: isBunnyStorageConfigured() }),
    ).toThrow()
  })
})
