import { describe, expect, it, vi } from 'vitest'
import {
  defineJob,
  enqueue,
  isQueueStarted,
  schedule,
  startQueue,
  stopQueue,
} from '../src/services/queue.js'
import '../src/jobs/index.js'

/**
 * The queue module without a database. Under NODE_ENV=test startQueue() is a
 * no-op, so every enqueue takes the inline path — which is also what production
 * does with BOSS_ENABLED=0, and what callers rely on to keep today's
 * synchronous behaviour.
 */
describe('job queue (inline fallback)', () => {
  it('does not start under test', async () => {
    await startQueue()
    expect(isQueueStarted()).toBe(false)
  })

  it('rejects a duplicate job name', () => {
    defineJob('test-dup', { handler: async () => null })
    expect(() => defineJob('test-dup', { handler: async () => null })).toThrow(/already defined/)
  })

  it('rejects a job without a handler', () => {
    expect(() => defineJob('test-no-handler', {})).toThrow(/handler must be a function/)
  })

  it('throws a clear error for an unknown job name', async () => {
    await expect(enqueue('test-never-defined', {})).rejects.toThrow(
      /Unknown job "test-never-defined"/,
    )
  })

  it('runs the handler inline and resolves with its result', async () => {
    defineJob('test-double', { handler: async ({ n }) => n * 2 })
    await expect(enqueue('test-double', { n: 21 })).resolves.toBe(42)
  })

  it('ignores scheduling options inline', async () => {
    defineJob('test-later', { handler: async () => 'ran now' })
    const later = new Date(Date.now() + 3_600_000)
    await expect(
      enqueue('test-later', {}, { startAfter: later, singletonKey: 'k', retryLimit: 0 }),
    ).resolves.toBe('ran now')
  })

  it('rejects with the error a handler throws', async () => {
    const boom = new Error('provider down')
    defineJob('test-throws', {
      handler: async () => {
        throw boom
      },
    })
    await expect(enqueue('test-throws', {})).rejects.toBe(boom)
  })

  it('round-trips data through noop', async () => {
    const data = { hello: 'world', nested: { n: 1 } }
    await expect(enqueue('noop', data)).resolves.toEqual(data)
  })

  it('calls the handler with the single data object, not a wrapper or an array', async () => {
    const handler = vi.fn(async () => 'ok')
    defineJob('test-shape', { handler })
    const data = { orderId: 'abc' }
    await enqueue('test-shape', data)
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler.mock.calls[0]).toHaveLength(1)
    expect(handler.mock.calls[0][0]).toBe(data)
  })

  it('treats schedule() as a no-op and stopQueue() as safe when never started', async () => {
    await expect(schedule('noop', '0 3 * * *', {})).resolves.toBeUndefined()
    await expect(schedule('test-never-defined', '0 3 * * *')).rejects.toThrow(/Unknown job/)
    await expect(stopQueue()).resolves.toBeUndefined()
    expect(isQueueStarted()).toBe(false)
  })
})
