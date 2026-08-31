# Plan: all-full-production-level

Take Growth Scholar from a demo build that cannot collect money or deliver video to a production-grade platform that sells courses, enforces access, and can be operated safely.

## Goal

Ship a live, revenue-capable site on Day 1 using manual UPI checkout while Razorpay KYC clears, then complete the production arc: Razorpay, moderation, data integrity, observability, and tests.

## Context

Growth Scholar is a MERN LMS + marketing platform (~13.2k LOC; 27 Mongoose models, ~100 endpoints, 54 React pages) ported from a static site. It looks finished and is not.

Confirmed defects driving this plan:

- **No paywall.** `POST /api/enrollments` never reads `course.price`/`amount` — any logged-in user gets every paid course free (`server/src/routes/enrollment.routes.js:12-34`), while the UI advertises "Enroll Now — ₹2,499" (`client/src/pages/public/CourseDetail.jsx:131-135`).
- **No video player.** `onClick={() => toast.show('Video playback is not wired up in this build')}` (`client/src/pages/student/CoursePlayer.jsx:81`). Videos already exist in Bunny Stream.
- **Login page publishes the admin password** (`client/src/pages/public/Login.jsx:53-58`).
- **Seeder is a production kill switch.** `seed.js:37-47` runs `deleteMany({})` across 27 collections with no `NODE_ENV` guard.
- **Gamification is inert.** `seeds` is written only by the seeder; `PointRule` is consumed by nothing; `LeaderboardEntry` is only ever seeded.
- **Funnels have no public surface.** No `/f/*` route exists; all metrics are hardcoded (`server/src/seed/data/admin.js:53`).
- **Community has no moderation** — no delete, report, or block of any kind.
- **Broadcast "send" mails nothing** (`server/src/routes/admin/email.routes.js:12-32`).
- **Footer policy links are `href="#"`** (`client/src/components/public/SiteFooter.jsx:53-55`).
- No git repository; no tests, lint, or CI; single ~483KB bundle with no code splitting.

## Approach

Fix the paywall and delivery first, sell through a recorded manual UPI flow while Razorpay KYC clears, and hide every module that is a UI shell.

Reuse what exists rather than rewriting: `Transaction.status` already has `PENDING`, and `POST /api/admin/customers/:id/enroll` (`server/src/routes/admin/customer.routes.js:24-50`) already contains grant-access logic to extract into a shared helper.

## Decisions & Rejected Alternatives

- **Manual UPI checkout on Day 1, Razorpay after** — Razorpay activation needs KYC review plus live policy pages (2–7 business days) and cannot be compressed. Rejected: launching with no sales channel (loses a week of revenue); rejected: waiting for Razorpay (misses the deadline).
- **Bunny Stream with server-signed token URLs** — videos are already in Bunny, so there is no transcode wait, and token auth makes the paywall real at the CDN rather than cosmetic. Rejected: Vimeo and unlisted YouTube (embeds are scrapeable, access unrevokable); rejected: S3+CloudFront (owns transcoding/HLS, ~2 weeks).
- **Webhook as source of truth for Razorpay** — a client callback alone loses the grant if the buyer closes the tab mid-redirect. Idempotent on `razorpay_payment_id`.
- **Keep hand-rolled JWT auth, fill its gaps** — password reset, rate limiting, helmet. Rejected: Clerk migration (~4–6 days touching AuthContext, ProtectedRoute, attachUser and 27 models referencing User — wrong risk in this window).
- **Hide Funnels / Email / Gamification behind flags** — all three are complete UIs backed by nothing; shipping them would show customers fabricated leaderboards and silently drop broadcast emails. Files are kept, so it is reversible. Rejected: building them for real (3+ weeks, competes with payments).
- **Real content kept, fabricated data wiped** — 13 courses, blog, workshops and channels are genuine; the 6 demo students, fake transactions, customers, leads, funnel leads and leaderboard entries are not.
- **Resend for transactional email** — ~30 min to integrate vs Zoho ZeptoMail (stack fit, more friction) or SES (sandbox approval, self-built templates). Speed wins in this window.
- **Express serves `client/dist` on a single origin** — removes the cross-origin cookie problem entirely rather than configuring nginx CORS on launch night.
- **Hostinger VPS + MongoDB Atlas** — Atlas is non-negotiable regardless of app host; it holds every payment record and self-hosted Mongo has no backup story. Rejected: self-hosted Mongo (one disk failure loses all customers).
- **No GST** — entity and bank exist, GST is not registered. Invoices show no tax component; pricing stays all-inclusive. Watch the ₹20L threshold.
- **Mobile QA on the revenue path only** — 118 desktop-down breakpoints but only 34 below 768px, and Indian D2C education traffic is 75–85% mobile. Dashboard/community/admin deferred.
- **Disk-only plan, no GitHub** — repo creation was declined. Task 1 still runs `git init` locally so version control exists before deploy.

## Tasks

| # | Task | Phase | Type | Depends on |
|---|------|-------|------|------------|
| 1 | git-init-and-secrets | 1 | mechanical | — |
| 2 | security-blockers | 1 | backend | — |
| 3 | seed-split-and-guard | 1 | backend | — |
| 4 | legal-policy-pages | 1 | ui | — |
| 5 | hide-nonfunctional-modules | 1 | ui | — |
| 6 | paywall-and-enrollment-expiry | 2 | backend | 1 |
| 7 | resend-email-infrastructure | 2 | backend | 1 |
| 8 | bunny-playback-signing | 3 | backend | 6 |
| 9 | password-reset-flow | 3 | backend | 7 |
| 10 | upi-checkout-flow | 3 | backend | 6, 7 |
| 11 | course-player-ui | 4 | ui | 8 |
| 12 | admin-approve-and-grant-access | 4 | backend | 10 |
| 13 | production-content-seed | 4 | mechanical | 3 |
| 14 | deploy-hostinger-atlas | 5 | mechanical | 11, 12, 13 |
| 15 | mobile-revenue-path-qa | 5 | ui | 11, 12 |
| 16 | razorpay-integration | 6 | backend | 12, 14 |
| 17 | community-moderation | 6 | backend | 14 |
| 18 | data-integrity-fixes | 6 | backend | 14 |
| 19 | observability-and-error-boundary | 6 | backend | 14 |
| 20 | money-path-tests | 7 | testing | 16 |
| 21 | eslint-prettier-tooling | 7 | mechanical | 14 |

## Execution phases

Within a phase, all tasks are independent and can run in parallel. Phases run in order.

- **Phase 1:** 1, 2, 3, 4, 5 — independent hygiene, security and content work
- **Phase 2:** 6, 7 — the two foundations everything else builds on
- **Phase 3:** 8, 9, 10 — playback signing, password reset, checkout
- **Phase 4:** 11, 12, 13 — player UI, admin grant flow, real data
- **Phase 5:** 14, 15 — deploy and mobile QA
- **Phase 6:** 16, 17, 18, 19 — post-launch production hardening
- **Phase 7:** 20, 21 — tests and tooling

## Day 1 scope

**Day 1 ship = phases 1–5**, roughly 22 hours of work.

If the deadline is fixed at one day, the honest cut line is:

- **Ship (~12h):** tasks 1, 2, 3, 4, 6, 8, 10, 11, 12, 13, 14
- **Defer one day (~10h):** tasks 5, 7, 9, 15 — accepting that without 7 and 9 you send access details manually and password resets are direct DB edits

**Never cut:** task 2 (the login page publishes the admin password) and task 6 (every course is free to anyone with an account).

## Progress

Tracking is disk-only by design (see "Disk-only plan, no GitHub" above). A task is
done when its commit exists on `master` — `git log --oneline --grep '\[task-NN\]'`
is the source of truth. Anything without a commit below has not run.

### Phase 1 — complete (2026-08-10)

| # | Task | Model | Commit |
|---|------|-------|--------|
| 1 | git-init-and-secrets | sonnet-5:high | `5d5a513` (baseline), `e0be7b4` |
| 2 | security-blockers | opus-4.8:max | `21bddbb` |
| 3 | seed-split-and-guard | opus-4.8:max | `9e6005e` |
| 4 | legal-policy-pages | opus-4.8:high | `93d6501` |
| 5 | hide-nonfunctional-modules | opus-4.8:max | `8dcef6f` |

Run in three collision-free waves rather than one parallel batch — tasks 2/3 both
edit `server/src/seed/seed.js`, tasks 4/5 both edit `client/src/App.jsx`, and
tasks 1/5 both edit `server/src/config/env.js`, despite all five declaring
`depends_on: []`. Wave A: 1. Wave B: 2, 4. Wave C: 3, 5.

Post-phase check: `npm run build` in `client/` passes; all changed server files
pass `node --check`.

### Phase 2 — complete (2026-08-11)

| # | Task | Commit |
|---|------|--------|
| 6 | paywall-and-enrollment-expiry | `8514e60` |
| 7 | resend-email-infrastructure | `d9c1f09` |

### Phase 3 — complete (2026-08-11)

| # | Task | Commit |
|---|------|--------|
| 8 | bunny-playback-signing | `f548672` |
| 9 | password-reset-flow | `3156725` |
| 10 | upi-checkout-flow | `e95c9c5` |

### Phase 4 — complete (2026-08-11)

| # | Task | Commit |
|---|------|--------|
| 11 | course-player-ui | `ef3ae7c` |
| 12 | admin-approve-and-grant-access | `212517a` |
| 13 | production-content-seed | `2f58b74` |

### Phase 5 — complete (2026-08-11)

| # | Task | Commit |
|---|------|--------|
| 14 | deploy-hostinger-atlas | `f56fd24` |
| 15 | mobile-revenue-path-qa | `0fdb177` |

### Phase 6 — complete (2026-08-11)

| # | Task | Commit |
|---|------|--------|
| 16 | razorpay-integration | `9c2d9a8` |
| 17 | community-moderation | `cb3575f` |
| 18 | data-integrity-fixes | `efe1562` |
| 19 | observability-and-error-boundary | `edf3308` |

### Phase 7 — complete (2026-08-11)

| # | Task | Commit |
|---|------|--------|
| 20 | money-path-tests | `e7ca865` |
| 21 | eslint-prettier-tooling | `9af1cd1`, `22e3a53` (formatting, isolated) |

Every task ran sequentially rather than in phase batches, because each phase's
tasks turned out to share files in practice (6/8/10 all edit
`enrollment.routes.js` and `checkout.routes.js`; 12/16 both rewrite
`admin/Transactions.jsx`; 18/21 both touch `admin/email.routes.js`).

**Suite: 52 tests, ~32s. `npm run lint`: 0 errors both packages. `npm run build`
passes.**

### Phase 1 follow-ups — now closed

- **CSP not governing the SPA.** Closed by task 14: Express serves `client/dist`
  on one origin, and the helmet CSP was verified reaching the rendered page.
- **Community leaderboard fabricated.** Closed: the hardcoded 8-person rail is
  now gated on `FEATURE_GAMIFICATION`, like the rest of the module. Nothing
  awards seeds, so it could only ever be invented.
- **README seed docs stale.** Closed — and the README was still printing
  `password123` in its seeded-accounts table, the same credential task 2 removed
  from the login page. It now documents the content/demo split and points at
  `SEED_PASSWORD`.

### Still open — these need a person, not code

- **Re-seed required.** The local DB still holds `password123` hashes for
  accounts seeded before task 1. Rotate before any deploy:
  `npm --prefix server run seed:demo` with a fresh `SEED_PASSWORD`.
- **Legal placeholders.** 11 `[[ TO BE CONFIRMED ]]` fields in
  `client/src/data/legal.js` need business input (legal entity name, registered
  address, phone, jurisdiction city, support hours, grievance officer, payment
  confirmation SLA, refund window/consumption limit/processing days, live
  cancellation cutoff). **Razorpay KYC is blocked until these are real** — the
  review rejects placeholder text — and task 16's code is otherwise done.
- **Social links.** `socialLinks[].href` in `client/src/data/nav.js` render as
  non-interactive badges until real URLs are supplied.
- **`Achievements.jsx` gated, not stripped.** Task 5 hid the whole route behind
  `FEATURE_GAMIFICATION` instead of removing the page's panels in place.
  Deliberate and reversible; left as is.
- **Infrastructure.** Atlas, the VPS, DNS, TLS, the Bunny Token Authentication
  toggle, Resend domain verification, Razorpay KYC and the uptime monitor all
  need accounts and credentials. Code and runbooks are in `docs/`; none of it is
  provisioned.
- **Real-device mobile QA.** Task 15's fixes are code-complete and unverified on
  a handset. `docs/mobile-qa.md` carries the checklist.

## Verification

Run these before announcing the URL.

1. **Paywall** — as a fresh student, `POST /api/enrollments {"slug":"seo-mastery"}` returns **402**, not an enrollment.
2. **Playback** — playback URL for a non-enrolled course → 403; enrolled → a signed Bunny URL that plays and **stops working after ~15 minutes** on replay.
3. **Expiry** — set an enrollment's `expiresAt` to yesterday; the player locks.
4. **Checkout end-to-end** — buy via `/checkout/:slug` at ₹1, confirm a PENDING transaction in admin, approve it, confirm account creation, access email delivery, and course access.
5. **Password reset** — full round trip on a real inbox.
6. **Credential leak** — `curl` the deployed `/login` and grep for `password123`; must be empty.
7. **Seed guard** — run `npm run seed` against the production URI with `NODE_ENV=production`; must refuse.
8. **Hidden modules** — `curl /api/admin/funnels`, `/api/admin/email/broadcasts`, `/api/admin/gamification/points` as admin → 404.
9. **Mobile** — complete a real purchase on a phone at 360px, start to finish.
10. **Backups** — trigger an Atlas snapshot and confirm it lists.
