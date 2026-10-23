import { defineJob } from '../services/queue.js'
// Transactional mail: send-mail, send-password-reset.
import './mail.js'
// Post-payment notifications: fulfil-payment-side-effects.
import './fulfilment.js'

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
