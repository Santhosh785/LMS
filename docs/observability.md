# Observability (task 19)

Before this there was no error tracking, no monitoring and no React error
boundary. Server errors went to `morgan('dev')` on stdout — which on a VPS means
they vanish — and client errors went to a browser console nobody is watching.
"A user says checkout didn't work" had no evidence behind it.

## Error boundaries

Two, at different levels, because they fail differently:

- **Root** (`main.jsx`) — wraps the providers themselves. Last resort, for a
  failure where there is no router left to navigate with.
- **Route** (`App.jsx`) — wraps the route outlet, so an ordinary broken page
  keeps the header and navigation working.

The route boundary is **keyed on `pathname`**. This is the part that is easy to
get wrong: without the key, a boundary that has caught an error holds it forever
and every subsequent navigation renders the same failure page. Changing the key
remounts it, clearing the error the moment the visitor goes elsewhere.

Both show a human message with a *Try again* and a *Back home*, never a stack
trace — the stack renders only under `import.meta.env.DEV`.

To test: throw from any component's render and confirm you get the message, that
the header still works, and that navigating away clears it.

## Error tracking

Sentry on both sides, and **optional on both** — with no DSN, everything logs
locally and nothing throws. Same contract as the mail layer.

```
# server/.env
SENTRY_DSN=https://…@…ingest.sentry.io/…
RELEASE=2026-08-10-a          # stamped on events so a regression ties to a deploy

# client build environment
VITE_SENTRY_DSN=https://…
VITE_RELEASE=2026-08-10-a
```

Use **two projects** (node and react) so a server 500 and a render error do not
share an issue stream.

- **Server** — reported from the existing `errorHandler`, which already
  distinguishes 4xx from 5xx. **Only 5xx is sent.** A 401 on a mistyped password
  and a 404 on a stale link are normal traffic; reporting them buries the one
  event that matters under ten thousand that do not. `unhandledRejection` and
  `uncaughtException` are captured too, and the process exits on the latter —
  after an uncaught exception its state is undefined, and serving payments from
  it is worse than two seconds of downtime.
- **Client** — render errors from both boundaries, plus `unhandledrejection` and
  `window.onerror`. A rejected API call the UI has already shown as a form error
  is filtered out as noise.

The client SDK is **dynamically imported, and only when a DSN is set**, so its
~30KB stays out of the main bundle for builds that are not using it. The bundle
is already ~570KB with no code splitting.

### Never log secrets

Scrubbing happens **in this process, before anything leaves it** — not as a
dashboard setting, which is one click from being turned off by someone who does
not know why it is there. `scrub()` in `server/src/config/observability.js`
recursively redacts:

- `JWT_SECRET`, `BUNNY_SECURITY_KEY`, `RAZORPAY_KEY_SECRET`,
  `RAZORPAY_WEBHOOK_SECRET`, `RESEND_API_KEY`, `SEED_PASSWORD`
- any `password`, `passwordHash`, `token`, `cookie`, `authorization`,
  `signature`, `secret`, `apiKey`
- buyer contact details: `email`, `phone`, `contact`, `utr`, `vpa`, `buyer`,
  `address`

Query strings are stripped from URLs (that is where reset tokens end up),
`event.user` is cleared, and the `Cookie`, `Authorization` and
`X-Razorpay-Signature` headers are removed. The `userId` tag survives — it is
what makes a report actionable and is not personal data on its own.

Verified by inspecting a scrubbed payload directly; re-check it after adding any
new secret to `env.js`.

## Server logging

`combined` format in production, to **both** stdout (for the supervisor) and
`logs/access.log` (so it survives a restart). `dev` stays in development.

Rotation is logrotate's job — an unbounded log is its own outage:

```
# /etc/logrotate.d/growth-scholar
/opt/growth-scholar/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
}
```

`copytruncate` matters: the process holds the file open, so a plain rename would
leave it writing to an unlinked inode.

## Health check

```
GET /api/health
→ 200 {"ok":true,"db":"up","uptime":1234}
→ 503 {"ok":false,"db":"down","uptime":1234}
```

It used to return `{ ok: true }` unconditionally, so it reported healthy while
MongoDB was unreachable and every request 500ed — a monitor pointed at it would
have stayed green through a total outage. It now checks `readyState` **and**
round-trips a `ping`, because `readyState` lags a network partition.

## Uptime monitoring and alerts

**Not configured — this needs an account and a phone number, and has to be done
by hand.** Nothing below is verified.

1. **Uptime** — point a monitor (UptimeRobot free tier, Better Stack, Pingdom) at
   `https://growthscholar.in/api/health`, every 1–5 minutes, alerting on a
   non-200. Send alerts to a **phone**, not an inbox: a site down at 9pm needs to
   wake someone.
2. **5xx spike** — Sentry → Alerts → *Number of errors* in a project exceeds
   ~10 in 5 minutes → notify. Sentry's default "a new issue appeared" alert is
   worth keeping on as well.
3. **Webhook failures** — the highest-value alert here. A silently failing
   Razorpay webhook means customers pay and receive nothing, which is the worst
   failure this system has. `captureMessage` already fires on: the webhook secret
   being unset, a signature failing verification, and a payment that could not be
   fulfilled. Route these to the same phone.
4. **Certificate expiry** — most uptime monitors check this. Certbot renews
   automatically, but the timer failing silently is a real outage a month later.

### Sanity check once configured

- Stop the Node process → the uptime monitor alerts within its interval.
- Stop MongoDB with Node running → `/api/health` returns 503 and it alerts.
- POST garbage to `/api/webhooks/razorpay` → a signature-failure event appears.
- Trigger a deliberate 500 → it appears in Sentry **with no email, phone, UTR or
  secret anywhere in the payload**. Open the real event and read it; do not
  assume.
