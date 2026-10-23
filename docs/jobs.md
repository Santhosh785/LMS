# Background jobs (pg-boss)

Work that should not hold up a request, or must survive a crash and be retried —
transactional mail, order fulfilment, content and cache work in later tasks —
goes on a durable queue. The queue is [pg-boss](https://github.com/timgit/pg-boss)
v12: its state lives in the existing Supabase Postgres under the `pgboss` schema,
and its workers run inside the Express process. There is no Redis and no second
service to deploy.

This task delivers only the infrastructure and one trivial `noop` job. No mail or
fulfilment call site uses it yet.

pg-boss v12 needs **Node 22.12 or newer**; the root `package.json` says so in
`engines`.

## Defining and enqueueing a job

Everything goes through `server/src/services/queue.js`. Nothing else imports
pg-boss.

```js
// server/src/jobs/receipts.js
import { defineJob } from '../services/queue.js'

defineJob('send-receipt', {
  // Called with the job's data object — one job, never an array or the pg-boss
  // wrapper. Throwing fails the attempt and pg-boss retries it.
  handler: async ({ transactionId }) => {
    await sendReceipt(transactionId)
  },
})
```

```js
// at the call site
import { enqueue } from '../services/queue.js'

await enqueue('send-receipt', { transactionId }, { singletonKey: `receipt:${transactionId}` })
```

- `defineJob(name, { handler, queueOptions, workOptions })` registers a job.
  Names are unique, and jobs must be defined **before** `startQueue()`: import the
  module from `server/src/jobs/index.js`, which the server entry imports ahead of
  boot. `queueOptions` go to pg-boss `createQueue` and only apply when the queue
  is first created; `workOptions` go to `work`, with the batch size pinned to 1.
- `enqueue(name, data, options)` passes options straight to pg-boss `send`
  (`singletonKey`, `startAfter`, `retryLimit`, `priority`, …). Unless overridden
  every job gets `retryLimit: 5`, `retryBackoff: true`, `retryDelay: 5` and
  `retryDelayMax: 600` — exponential backoff of roughly 5s, 10s, 20s, 40s, 80s.
  It resolves with the job id, or `null` when a singleton key deduplicated it.
  An unknown name is an error.
- `schedule(name, cron, data)` registers a cron schedule for a defined job. Call
  it after `startQueue()`; without a running queue it does nothing.
- A handler must be **idempotent**. A job can run more than once — a retry after
  a timeout, or a crash after the work but before pg-boss recorded completion.

## Inline fallback

When the queue is not started, `enqueue` runs the handler **inline** and returns
its result, or rejects with its error — exactly the synchronous behaviour call
sites had before the queue existed. Scheduling options (`startAfter`,
`singletonKey`, retries) are ignored in that mode.

The queue is not started:

- under test (`NODE_ENV=test`) — the suite never starts pg-boss;
- with `BOSS_ENABLED=0`;
- during boot, before `startQueue()` has finished, and during shutdown, once
  `stopQueue()` has begun.

## Configuration

```
# server/.env
BOSS_DATABASE_URL=postgresql://…:5432/postgres   # defaults to DIRECT_DATABASE_URL
BOSS_ENABLED=1                                  # 0 = run every job inline
```

**`BOSS_DATABASE_URL` must be a session-capable connection**: the direct
connection on port 5432, or Supabase's *session-mode* pooler. **Never the
transaction pooler on 6543.** pg-boss relies on session state — advisory locks,
LISTEN, prepared statements — which a transaction pooler silently hands to
another client between statements. It defaults to `DIRECT_DATABASE_URL` (itself
falling back to `DATABASE_URL`), so a deployment whose `DATABASE_URL` is the
:6543 pooler must set one of the two.

Fixed in code, not the environment: schema `pgboss`, a pool of at most **3**
connections, and the same TLS handling as the Drizzle pool (TLS with
`rejectUnauthorized: false` when the URL contains `supabase`).

pg-boss `error` events go to `captureMessage` (and so to Sentry when it is
configured), so a maintenance failure is reported rather than crashing the
process. Warnings are logged.

## Turning it off (rollback)

Set `BOSS_ENABLED=0` and restart. The app returns to running every job inline,
as before this task. Nothing is deleted: jobs already queued stay in the
`pgboss` tables untouched, and are worked as soon as the queue is enabled again
and the process restarts.

## Boot and shutdown

The queue starts after the runtime-config refresh and **before** the port opens,
so a request that enqueues a job finds the workers running. On first start
pg-boss creates the `pgboss` schema itself; every defined job's queue is created
before any send or work call. A failure to start exits the process non-zero,
like any other boot failure.

On `SIGTERM` or `SIGINT` the server stops accepting connections, stops the queue
— no new jobs are fetched, and in-flight handlers get up to **30 seconds** to
finish — closes the database pool and exits 0. The whole sequence is capped at
30 seconds; a second signal, or hitting the cap, forces an exit. A job cut off
that way is not lost: pg-boss marks it failed and it is retried, or — if the
process was killed outright — it expires after 15 minutes and is retried then.

Give the supervisor a stop timeout longer than 30 seconds (Docker/Coolify's
stop grace period, PM2's `kill_timeout`, systemd's `TimeoutStopSec`), or it will
`SIGKILL` the process mid-drain.

## Inspecting state

Run these in the Supabase SQL editor or `psql` against `BOSS_DATABASE_URL`.

```sql
-- Jobs by queue and state
select name, state, count(*)
from pgboss.job
group by name, state
order by name, state;

-- The most recent failures, with the error each one stored
select id, name, retry_count, completed_on, output->>'message' as error, output
from pgboss.job
where state = 'failed'
order by completed_on desc
limit 20;

-- Jobs waiting on a retry, and when they next run
select id, name, retry_count, retry_limit, start_after, output->>'message' as last_error
from pgboss.job
where state = 'retry'
order by start_after;

-- Cron schedules
select name, key, cron, timezone, data, updated_on
from pgboss.schedule
order by name;

-- Queues and their settings (counts are refreshed periodically by pg-boss)
select name, policy, retry_limit, queued_count, active_count, failed_count
from pgboss.queue
order by name;
```

Completed jobs are kept for 7 days and then deleted by pg-boss's own
maintenance; jobs never started are dropped after 14 days.

### Smoke test

Enqueue a `noop` by hand from `server/` — it starts a short-lived worker of its
own, so it completes even with the app stopped:

```
node --input-type=module -e "
import './src/jobs/index.js'
import { startQueue, enqueue, stopQueue } from './src/services/queue.js'
await startQueue()
console.log('job id', await enqueue('noop', { hello: 'ops' }))
await new Promise((r) => setTimeout(r, 3000))
await stopQueue()
"
```

Then the first query above shows a `noop | completed` row. The automated
equivalent is `server/tests/queue.integration.test.js`, which runs only when
`BOSS_DATABASE_URL` is set.
