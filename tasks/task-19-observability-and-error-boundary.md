---
task: 19
name: observability-and-error-boundary
parallel_group: 6
depends_on: [14]
type: backend
---

# Task 19: Observability and error boundaries

## What to build

There is no error tracking, no monitoring and no React error boundary anywhere in the application. Server errors go to `morgan('dev')` on stdout, which on a VPS means they vanish. Client errors go to a browser console nobody is watching.

Once real customers are paying, "a user says checkout didn't work" needs to be answerable from evidence rather than guesswork.

**React error boundary.** `client/src/App.jsx` has no boundary at any level. Any render error white-screens the entire application with no message and no recovery. Add a boundary at the app root and, separately, around the route outlet so one broken page does not take down navigation. Show a human message with a way back, not a stack trace.

**Error tracking.** Wire Sentry (or an equivalent) on both sides:

- Server — capture unhandled errors through the existing `errorHandler` middleware in `server/src/middleware/error.js`, which already distinguishes 4xx from 5xx. Report 5xx; do not report routine 4xx.
- Client — capture render errors from the boundaries and unhandled promise rejections.

**Never log secrets.** Scrub the auth cookie, `JWT_SECRET`, `BUNNY_SECURITY_KEY`, Razorpay keys, `RESEND_API_KEY` and buyer contact details before anything leaves the process. Error trackers are third-party services and payloads persist there.

**Server logging.** `morgan('dev')` is a development formatter — colourised, no timestamps, unparseable. Switch to a production format when `NODE_ENV=production`, writing somewhere durable rather than only stdout.

**Health check.** `GET /api/health` exists and returns `{ ok: true }` unconditionally — it reports healthy even when MongoDB is unreachable. Make it verify the database connection so an uptime monitor detects a real outage. Point an external uptime monitor at it.

**Alert on what matters.** At minimum: the site being down, and a spike in 5xx responses. Once task 16 lands, add webhook processing failures — a silently failing Razorpay webhook means customers pay and receive nothing, which is the worst failure this system has.

## Acceptance criteria

- [ ] A deliberate render error shows a recoverable message, not a white screen
- [ ] A broken page does not break navigation to other pages
- [ ] Server 5xx errors appear in the error tracker with stack traces; 4xx do not
- [ ] Client render errors and unhandled rejections are captured
- [ ] No secret or buyer contact detail appears in any captured payload, verified by inspecting a real event
- [ ] Production logs carry timestamps, are machine-parseable, and survive a process restart
- [ ] `GET /api/health` returns unhealthy when MongoDB is unreachable
- [ ] An external uptime monitor is watching the health endpoint and alerts on failure
- [ ] A 5xx spike triggers an alert that actually reaches someone
