import { randomUUID } from 'node:crypto'
import express from 'express'
import pg from 'pg'
import request from 'supertest'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { env, resolveRateLimitStore } from '../src/config/env.js'
import { LIMITER_PREFIXES, createLimiters } from '../src/middleware/rateLimit.js'
import {
  PostgresRateLimitStore,
  createThrottledReporter,
} from '../src/middleware/rateLimitStore.js'

/**
 * The shared rate-limit store (task 5). The limiters skip under NODE_ENV=test,
 * so these build their own with `skip: () => false` and an injected store.
 */

const DB = 'postgres://u:p@db.example/app'

describe('RATE_LIMIT_STORE', () => {
  it('defaults to postgres in production', () => {
    expect(resolveRateLimitStore({ NODE_ENV: 'production', DATABASE_URL: DB })).toBe('postgres')
  })

  it('defaults to memory under test, even with a database', () => {
    expect(resolveRateLimitStore({ NODE_ENV: 'test', DATABASE_URL: DB })).toBe('memory')
  })

  it('defaults to memory when no database URL is configured', () => {
    expect(resolveRateLimitStore({ NODE_ENV: 'production', DATABASE_URL: '' })).toBe('memory')
    expect(resolveRateLimitStore({ NODE_ENV: 'production' })).toBe('memory')
  })

  it('defaults to memory in development', () => {
    expect(resolveRateLimitStore({ NODE_ENV: 'development', DATABASE_URL: DB })).toBe('memory')
  })

  it('lets an explicit value win over the default', () => {
    expect(
      resolveRateLimitStore({ RATE_LIMIT_STORE: 'postgres', NODE_ENV: 'test', DATABASE_URL: DB }),
    ).toBe('postgres')
    expect(
      resolveRateLimitStore({
        RATE_LIMIT_STORE: ' Memory ',
        NODE_ENV: 'production',
        DATABASE_URL: DB,
      }),
    ).toBe('memory')
  })

  it('rejects unknown values and postgres without a database', () => {
    expect(() => resolveRateLimitStore({ RATE_LIMIT_STORE: 'redis', DATABASE_URL: DB })).toThrow(
      /RATE_LIMIT_STORE/,
    )
    expect(() => resolveRateLimitStore({ RATE_LIMIT_STORE: 'postgres' })).toThrow(/DATABASE_URL/)
  })

  it('is memory for this suite', () => {
    expect(env.rateLimitStore).toBe('memory')
  })
})

/**
 * A stand-in for the database: one Map shared by every "process" that is handed
 * it, keyed by prefix and key the way the real store's session rows are.
 */
class SharedMapStore {
  localKeys = false
  constructor(table, prefix) {
    this.table = table
    this.prefix = prefix
  }
  init(options) {
    this.windowMs = options.windowMs
  }
  async increment(key) {
    const id = `${this.prefix}\u0000${key}`
    const hit = this.table.get(id) ?? {
      totalHits: 0,
      resetTime: new Date(Date.now() + this.windowMs),
    }
    hit.totalHits += 1
    this.table.set(id, hit)
    return { ...hit }
  }
  async decrement() {}
  async resetKey() {}
}

/** One Express app per "process", mounting every limiter on its own path. */
function appWith(limiters) {
  const app = express()
  app.use(express.json())
  for (const [name, limiter] of Object.entries(limiters)) {
    app.post(`/${name}`, limiter, (_req, res) => res.json({ ok: true, name }))
  }
  return app
}

const noReports = () => {
  throw new Error('nothing should be reported')
}

describe('limiter prefixes', () => {
  it('gives each of the seven limiters its own prefix and store instance', () => {
    const seen = []
    const limiters = createLimiters({
      storeFor: (prefix) => {
        const store = new SharedMapStore(new Map(), prefix)
        seen.push(store)
        return store
      },
      skip: () => false,
    })

    expect(Object.keys(limiters)).toHaveLength(7)
    expect(seen).toHaveLength(7)
    const prefixes = seen.map((s) => s.prefix)
    expect(new Set(prefixes).size).toBe(7)
    expect(prefixes.sort()).toEqual(Object.values(LIMITER_PREFIXES).sort())
  })

  it('does not let one limiter spend another limiter’s budget', async () => {
    const table = new Map()
    const app = appWith(
      createLimiters({
        storeFor: (prefix) => new SharedMapStore(table, prefix),
        skip: () => false,
        report: noReports,
      }),
    )

    for (let i = 0; i < 5; i += 1) await request(app).post('/loginLimiter').expect(200)
    await request(app).post('/loginLimiter').expect(429)

    // Same IP, same window — every other budget is untouched.
    for (const name of [
      'registerLimiter',
      'passwordResetIpLimiter',
      'passwordResetEmailLimiter',
      'checkoutLimiter',
      'blogCommentLimiter',
      'reportLimiter',
    ]) {
      await request(app).post(`/${name}`).send({ email: 'a@example.in' }).expect(200)
    }
  })
})

describe('shared counters across processes', () => {
  it('refuses the sixth login whichever process answers it', async () => {
    const table = new Map()
    const build = () =>
      appWith(
        createLimiters({
          storeFor: (prefix) => new SharedMapStore(table, prefix),
          skip: () => false,
          report: noReports,
        }),
      )
    const processes = [build(), build()]

    const statuses = []
    for (let i = 0; i < 6; i += 1) {
      const res = await request(processes[i % 2]).post('/loginLimiter')
      statuses.push(res.status)
    }
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429])
  })

  it('keeps the response contract: headers, body and the silent reset limit', async () => {
    const table = new Map()
    const app = appWith(
      createLimiters({
        storeFor: (prefix) => new SharedMapStore(table, prefix),
        skip: () => false,
        report: noReports,
      }),
    )

    const first = await request(app).post('/loginLimiter')
    expect(first.headers['ratelimit-policy']).toBe('5;w=900')
    expect(first.headers.ratelimit).toMatch(/^limit=5, remaining=4, reset=\d+$/)
    expect(first.headers['x-ratelimit-limit']).toBeUndefined()
    for (let i = 0; i < 4; i += 1) await request(app).post('/loginLimiter')
    const blocked = await request(app).post('/loginLimiter').expect(429)
    expect(blocked.body).toEqual({
      error: 'Too many attempts from this device. Please wait 15 minutes and try again.',
    })

    // Per-address reset: no headers, and the limit answers like a success.
    for (let i = 0; i < 5; i += 1) {
      await request(app).post('/passwordResetEmailLimiter').send({ email: 'x@example.in' })
    }
    const silent = await request(app)
      .post('/passwordResetEmailLimiter')
      .send({ email: 'X@example.in ' })
      .expect(200)
    expect(silent.body).toEqual({
      ok: true,
      message: 'If that email has an account, a reset link is on its way.',
    })
    expect(silent.headers.ratelimit).toBeUndefined()
  })
})

describe('store failure', () => {
  class FailingStore {
    localKeys = false
    constructor(prefix) {
      this.prefix = prefix
    }
    async increment() {
      throw Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:6543'), {
        code: 'ECONNREFUSED',
      })
    }
    async decrement() {}
    async resetKey() {}
  }

  it('lets requests through and reports at most once a minute', async () => {
    let clock = 1_000_000
    const sink = vi.fn()
    const report = createThrottledReporter({ now: () => clock, sink })
    const app = appWith(
      createLimiters({ storeFor: (p) => new FailingStore(p), skip: () => false, report }),
    )

    // Far past every limit, across several limiters, all inside one minute.
    for (let i = 0; i < 30; i += 1) {
      await request(app).post('/loginLimiter').expect(200)
      await request(app).post('/checkoutLimiter').expect(200)
    }
    expect(sink).toHaveBeenCalledTimes(1)
    expect(sink.mock.calls[0][1]).toMatchObject({
      limiter: 'login',
      code: 'ECONNREFUSED',
      suppressedSinceLastReport: 0,
    })

    clock += 59_000
    await request(app).post('/loginLimiter').expect(200)
    expect(sink).toHaveBeenCalledTimes(1)

    clock += 1_000
    await request(app).post('/registerLimiter').expect(200)
    expect(sink).toHaveBeenCalledTimes(2)
    expect(sink.mock.calls[1][1]).toMatchObject({
      limiter: 'register',
      suppressedSinceLastReport: 60,
    })
  })

  it('fails open against a database that is not there', async () => {
    // Nothing listens on port 1: the connection is refused at once.
    const pool = new pg.Pool({
      connectionString: 'postgres://nobody:nothing@127.0.0.1:1/none',
      connectionTimeoutMillis: 2_000,
    })
    const sink = vi.fn()
    const report = createThrottledReporter({ sink })
    const app = appWith(
      createLimiters({
        storeFor: (prefix) => new PostgresRateLimitStore({ prefix, pool }),
        skip: () => false,
        report,
      }),
    )

    for (let i = 0; i < 8; i += 1) await request(app).post('/loginLimiter').expect(200)
    expect(sink).toHaveBeenCalledTimes(1)
    await pool.end()
  })
})

/**
 * Against the real database the suite runs on — the transaction pooler in the
 * standard setup. Two pools stand in for two processes: neither shares any
 * memory with the other, only the `rate_limit` schema.
 */
describe('Postgres store', () => {
  const pools = []
  const prefixes = []
  const newPool = () => {
    const pool = new pg.Pool({
      connectionString: env.databaseUrl,
      max: 2,
      ssl: env.databaseUrl.includes('supabase') ? { rejectUnauthorized: false } : undefined,
    })
    pools.push(pool)
    return pool
  }
  const uniquePrefix = (name) => {
    const prefix = `test-${name}-${randomUUID()}`
    prefixes.push(prefix)
    return prefix
  }

  afterAll(async () => {
    if (pools.length && prefixes.length) {
      await pools[0]
        .query('delete from rate_limit.sessions where name_ = any($1)', [prefixes])
        .catch(() => {})
    }
    await Promise.all(pools.map((p) => p.end()))
  })

  it('creates its schema once even when processes race to it', async () => {
    const stores = [newPool(), newPool(), newPool()].map((pool) => {
      const store = new PostgresRateLimitStore({ prefix: uniquePrefix('race'), pool })
      store.init({ windowMs: 60_000 })
      return store
    })
    const results = await Promise.all(stores.map((s) => s.increment('203.0.113.7')))
    expect(results.map((r) => r.totalHits)).toEqual([1, 1, 1])
    expect(results[0].resetTime).toBeInstanceOf(Date)
  })

  it('shares one counter between two processes, and keeps prefixes apart', async () => {
    const login = uniquePrefix('login')
    const register = uniquePrefix('register')
    const build = (pool) =>
      appWith(
        createLimiters({
          storeFor: (prefix) =>
            new PostgresRateLimitStore({
              prefix: prefix === 'login' ? login : prefix === 'register' ? register : prefix,
              pool,
            }),
          skip: () => false,
          report: (err) => {
            throw err
          },
        }),
      )
    const processes = [build(newPool()), build(newPool())]

    const statuses = []
    for (let i = 0; i < 6; i += 1) {
      statuses.push((await request(processes[i % 2]).post('/loginLimiter')).status)
    }
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429])

    const reg = await request(processes[1]).post('/registerLimiter').expect(200)
    expect(reg.headers.ratelimit).toMatch(/remaining=4/)
  })
})
