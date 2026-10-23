import { defineJob } from '../services/queue.js'

/**
 * Every job definition, imported once by the server entry before startQueue()
 * so each queue exists and has a worker. A job module defines its jobs at import
 * time with defineJob(); add new ones as imports here.
 */

/**
 * Smoke test and test fixture: returns its data unchanged. An operator can
 * enqueue one by hand to prove the queue is working — see docs/jobs.md.
 */
defineJob('noop', { handler: async (data) => data })
