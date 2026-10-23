# Background jobs (pg-boss)

Work that should not hold up a request, or must survive a crash and be retried —
transactional mail, order fulfilment, content and cache work in later tasks —
goes on a durable queue. The queue is [pg-boss](https://github.com/timgit/pg-boss)
v12: its state lives in the existing Supabase Postgres under the `pgboss` schema,
and its workers run inside the Express process. There is no Redis and no second
service to deploy.

Defined jobs: `noop` (a smoke test), the transactional mail and payment jobs
described under [Mail and payment jobs](#mail-and-payment-jobs), and the sitemap
and edge-cache jobs under [Content-change jobs](#content-change-jobs).

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

## Mail and payment jobs

Transactional email and the side effects of a fulfilled payment run on the
queue, so a mail-provider failure is retried and nothing depends on the request
process staying alive. Request handlers queue them through `dispatch`
(`server/src/jobs/dispatch.js`), which **never rejects**: with the queue running
it awaits the enqueue (one insert) and alerts if that fails; inline it starts
the handler in the background, unawaited, and logs a failure — the
fire-and-forget behaviour these call sites had before. Neither ever fails the
request.

| Job | Data | Enqueued by |
| --- | --- | --- |
| `send-mail` | `{ template, to, data }` | checkout `payment-received` (manual UPI), `workshop-confirmation`, and the access-granted mail from the job below |
| `fulfil-payment-side-effects` | `{ transactionId, accountCreated }`, singleton key `fulfil:<transactionId>` | fulfilment `notify()` after the fulfilment transaction commits (manual UPI approval and the Razorpay webhook) |
| `send-password-reset` | `{ email }` | `POST /api/auth/forgot-password`, for every well-formed request |

**A deliberate skip is not a failure.** `send` (`server/src/mail/index.js`)
never throws; it returns `{ ok, skipped, error }`. `send-mail` throws — so
pg-boss retries — only on `ok: false, skipped: false`, a provider rejection or a
network failure, with the provider's message. A skip completes without retry:
no API key or sender configured (`ok: true, skipped: true`), an unknown
template, no recipient, or a template that failed to render (`ok: false,
skipped: true`). Retrying those cannot succeed.

`fulfil-payment-side-effects` trusts the payload for the id and the flag only.
It re-reads the transaction, the buyer's account, the course and the enrolment
expiry, and **sends nothing unless the transaction is `SUCCESS`** — a job for a
missing, pending, failed or since-refunded transaction completes quietly. Then:

1. when `accountCreated` is true (and the buyer has not set a password since),
   it issues a 24-hour invite token and sends `set-password`; a delivery
   failure throws and the whole job is retried, before anything else went out;
2. it queues `access-granted` as its own `send-mail` job, so a failure there is
   retried alone and the buyer is not sent a second set-password link.

Its queue uses pg-boss's `exclusive` policy: at most one job per singleton key
that is queued, waiting on a retry or running, so a duplicate enqueue collapses
(`enqueue` resolves `null`). The real guard against double fulfilment is
unchanged and synchronous: the `update … where status = 'PENDING' returning`
claim inside the fulfilment transaction, on the request. Only the winner of the
claim queues the job.

`send-password-reset` does the account lookup, the token and the mail inside
the job, so the endpoint does identical work for known and unknown addresses.
An unknown address completes without sending. A retry issues a fresh token,
replacing the one in the attempt that failed.

Still synchronous, because an admin is waiting on the outcome: the admin
"send test email" button and "resend set-password link" action call the mail
layer directly.

## Content-change jobs

When an admin changes public content, the sitemap and the Cloudflare edge cache
follow. Admin routes call `contentChanged({ kind, slug })`
(`server/src/services/contentEvents.js`), which queues one `regenerate-sitemap`
and one `purge-cloudflare-cache` job through `dispatch` — so, like mail, it
never fails or holds up the admin request.

| `kind` | Purged paths |
| --- | --- |
| `course` | `/`, `/courses`, `/courses/<slug>`, `/sitemap.xml` |
| `program` | `/`, `/programs/<slug>`, `/sitemap.xml` |
| `workshop` | `/`, `/workshops`, `/workshops/<slug>`, `/sitemap.xml` |
| `post` | `/`, `/blog`, `/blog/<slug>`, `/sitemap.xml` |
| `settings`, `taxonomy` | everything — the header and footer are on every page |

An unknown kind, or a slugged kind without a slug, throws. A rename passes
`slugs: [newSlug, oldSlug]` so both URLs are purged in one job; bulk blog
actions do the same with every affected post.

Where it fires:

- **Courses** — create, update and delete through the CRUD router (its
  `onChange(kind, row, previous)` option), publish/unpublish, and every tab save.
- **Programs** — CRUD create, update, delete, and every tab save.
- **Workshops** — CRUD create, update, delete, and an admin removing a
  registration (the page shows seats left).
- **Blog posts** — create, update (publishing is an update), trash, restore,
  revision restore, delete, bulk actions and import — each only when the post
  is, or just was, `Published` or `Scheduled`. Editing a draft purges nothing.
  Comment moderation does not fire.
- **Settings** — every tab save. **Taxonomy** — create, update, reorder, merge
  and delete.

| Job | Data | Notes |
| --- | --- | --- |
| `regenerate-sitemap` | `{}` | Broadcasts the `sitemap` invalidation scope so every instance drops its memo, then builds the sitemap once here. Queue policy `stately`: a burst of saves collapses into one queued rebuild. Also on cron `0 */6 * * *` (UTC), registered at boot. |
| `purge-cloudflare-cache` | `{ urls }` (relative paths) or `{ everything: true }` | Makes each path absolute against `PUBLIC_URL`, then `POST /client/v4/zones/{CF_ZONE_ID}/purge_cache` with `{ files }` in batches of at most 30, or one `{ purge_everything: true }`. Any non-2xx response throws, so the whole job is retried. |

Without `CF_ZONE_ID` or `CF_API_TOKEN` the purge job logs one line per process
and completes without a network call. **`PUBLIC_URL` must be the origin
Cloudflare caches** (`https://growthscholar.in`), or the purge matches nothing.

The two jobs are independent, so an edge miss on `/sitemap.xml` in the moment
between the purge and the sitemap invalidation can re-cache the old document;
its `max-age=600` bounds that, and the next change or the six-hourly run
replaces it.

## Configuration

```
# server/.env
BOSS_DATABASE_URL=postgresql://…:5432/postgres   # defaults to DIRECT_DATABASE_URL
BOSS_ENABLED=1                                  # 0 = run every job inline
CF_ZONE_ID=                                     # optional: edge purge after content changes
CF_API_TOKEN=                                   # optional: token with Zone > Cache Purge
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

-- Did the last content change reach the queue?
select name, state, data, created_on
from pgboss.job
where name in ('regenerate-sitemap', 'purge-cloudflare-cache')
order by created_on desc
limit 10;

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
