import { captureMessage } from '../config/observability.js'
import { enqueue, isQueueStarted } from '../services/queue.js'

/**
 * Hands a job off from a request without letting it fail or hold up the
 * request. Never rejects. See docs/jobs.md.
 *
 *  - Queue running: awaits the enqueue — one insert into the `pgboss` tables —
 *    so the job is durable before the response goes out. If that insert fails
 *    the notification would be lost, so it is alerted, but the request still
 *    succeeds: the payment, registration or reset request it is about has
 *    already been recorded.
 *
 *  - Inline (tests, BOSS_ENABLED=0, boot): `enqueue` would run the handler and
 *    wait for it — a mail provider round trip, and a throw when the provider
 *    fails. That is not awaited here: the handler runs in the background, as the
 *    fire-and-forget sends this replaces did, and its failure is logged rather
 *    than becoming an unhandled rejection or a failed request.
 */
export async function dispatch(name, data = {}, options = {}) {
  const durable = isQueueStarted()
  const pending = enqueue(name, data, options).catch((err) => {
    if (durable) {
      captureMessage(`Could not enqueue job "${name}"`, {
        error: err?.message,
        singletonKey: options.singletonKey,
      })
    } else {
      console.error(`[jobs] ${name} failed (inline, not retried):`, err?.message)
    }
    return null
  })
  if (durable) return pending
  return undefined
}
