import { defineJob } from '../services/queue.js'
// Transactional mail: send-mail, send-password-reset.
import './mail.js'
// Post-payment notifications: fulfil-payment-side-effects.
import './fulfilment.js'
// Content-change fan-out (services/contentEvents.js): regenerate-sitemap and
// purge-cloudflare-cache.
import { scheduleSitemapRegeneration } from './sitemap.js'
import './cloudflare.js'

/**
 * Every job definition, imported once by the server entry before startQueue()
 * so each queue exists and has a worker. A job module defines its jobs at import
 * time with defineJob(); add new ones as imports here.
 *
 * Call sites import the helper they enqueue through (queueMail, …) from the job
 * module itself, so a job is always defined before anything can enqueue it —
 * even in a script or test that never loads this file.
 */

/**
 * Smoke test and test fixture: returns its data unchanged. An operator can
 * enqueue one by hand to prove the queue is working — see docs/jobs.md.
 */
defineJob('noop', { handler: async (data) => data })

/**
 * Registers every cron schedule. Called by the server entry once startQueue()
 * has resolved; inline (queue not started) each is a no-op. A failure is logged
 * rather than failing boot: a missing schedule only loses the backstop run, and
 * the next boot registers it again.
 */
export async function scheduleRecurringJobs() {
  try {
    await scheduleSitemapRegeneration()
  } catch (err) {
    console.error('[queue] could not register the regenerate-sitemap schedule:', err?.message)
  }
}
