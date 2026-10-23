import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import pg from 'pg'
import { enqueue, isQueueStarted, startQueue, stopQueue } from '../src/services/queue.js'
import '../src/jobs/index.js'

/**
 * pg-boss end to end: start through the module's real start path, enqueue
 * `noop`, watch the row reach `completed`, stop. Runs only when
 * BOSS_DATABASE_URL is set (a session-capable connection — see docs/jobs.md);
 * skipped otherwise so the suite still runs without one.
 *
 * `allowInTest` lifts the NODE_ENV=test guard for this call only. Module state
 * is per test file under Vitest, so no other file sees a started queue.
 */
const url = process.env.BOSS_DATABASE_URL

describe.skipIf(!url)('job queue (pg-boss)', () => {
  const marker = `queue-it-${Date.now()}-${Math.random().toString(36).slice(2)}`
  let client

  beforeAll(async () => {
    client = new pg.Client({
      connectionString: url,
      ssl: url.includes('supabase') ? { rejectUnauthorized: false } : undefined,
    })
    await client.connect()
    await startQueue({ allowInTest: true })
  }, 120_000)

  afterAll(async () => {
    try {
      await stopQueue()
    } finally {
      // Leave nothing behind: the worker is stopped above, the rows go here.
      await client
        ?.query(`delete from pgboss.job where name = 'noop' and data->>'marker' = $1`, [marker])
        .catch(() => {})
      await client?.end().catch(() => {})
    }
  }, 60_000)

  it('creates the pgboss schema', async () => {
    const { rows } = await client.query(
      `select 1 from information_schema.schemata where schema_name = 'pgboss'`,
    )
    expect(rows).toHaveLength(1)
  })

  it('works a noop job through to completed', async () => {
    expect(isQueueStarted()).toBe(true)
    const id = await enqueue('noop', { marker })
    expect(typeof id).toBe('string')

    let state
    const deadline = Date.now() + 30_000
    while (Date.now() < deadline) {
      const { rows } = await client.query(
        `select state, output from pgboss.job where name = 'noop' and id = $1`,
        [id],
      )
      state = rows[0]?.state
      if (state === 'completed') {
        // The handler's return value is stored as the job's output.
        expect(rows[0].output).toEqual({ marker })
        break
      }
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
    expect(state).toBe('completed')
  }, 45_000)

  it('is not started after stopQueue()', async () => {
    await stopQueue()
    expect(isQueueStarted()).toBe(false)
  })
})
