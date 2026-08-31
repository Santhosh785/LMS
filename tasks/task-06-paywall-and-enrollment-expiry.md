---
task: 6
name: paywall-and-enrollment-expiry
parallel_group: 2
depends_on: [1]
type: backend
---

# Task 6: Real paywall and enrollment expiry

## What to build

This is the single most important task in the plan. **The product currently gives away every paid course for free.**

`POST /api/enrollments` (`server/src/routes/enrollment.routes.js`, lines 12–34) looks up a course by slug or id and creates an enrollment. It never reads `course.price`, never reads `course.amount`, and never checks for a payment. Any authenticated user can post a slug and receive full access. Meanwhile `client/src/pages/public/CourseDetail.jsx` renders a button reading "Enroll Now — ₹2,499" that calls exactly this endpoint. The UI states a price the backend never collects.

**Close the hole.** Self-enrollment must succeed only for courses where `price === 'free'`. For paid courses the endpoint must refuse — return `402 Payment Required` with a response body pointing at the checkout route that task 10 builds. Do not silently create a pending enrollment; refusing outright means a bug in a later task cannot accidentally grant access.

**Add expiry.** `Course.pricingPlans` sells `Lifetime`, `12 months` and `6 months` access tiers, but `Enrollment` has no expiry field at all — so a time-limited plan currently grants permanent access. Add to `server/src/models/Enrollment.js`:

- `expiresAt` — a nullable date; null means lifetime
- `source` — how access was granted, one of paid / manual / free, so a support question about why someone has access is answerable

Enforce `expiresAt` in `GET /api/enrollments/course/:slug` (lines 36–46), which already returns 403 when no enrollment exists. An expired enrollment must be treated as no access. Return a distinguishable error so the client can say "your access expired" rather than "you are not enrolled".

**Fix the non-atomic counters** while in this code. Line 29 does `course.enrolledCount += 1; await course.save()`, a read-modify-write that loses increments under concurrency. Replace with an atomic `$inc`. The same bug exists in two other places and should be fixed identically: `commentCount` in `server/src/routes/community.routes.js` (around line 111) and `registeredCount` in `server/src/routes/workshop.routes.js` (around line 43).

Task 12 will grant access after an admin approves a UPI payment. Expose a reusable `grantAccess(userId, courseId, { expiresAt, source })` helper here so task 12 consumes it rather than duplicating enrollment logic. Note that `POST /api/admin/customers/:id/enroll` (`server/src/routes/admin/customer.routes.js`, lines 24–50) already contains a correct upsert implementation — extract from it rather than writing new logic, and repoint that route at the shared helper.

## Acceptance criteria

- [ ] `POST /api/enrollments` with a paid course slug returns 402 and includes the checkout path
- [ ] `POST /api/enrollments` with a free course slug still enrolls successfully
- [ ] `Enrollment` has `expiresAt` and `source` fields; existing documents remain valid with null expiry
- [ ] `GET /api/enrollments/course/:slug` denies access when `expiresAt` is in the past, with an error distinct from the not-enrolled case
- [ ] `enrolledCount`, `commentCount` and `registeredCount` are updated with atomic `$inc`, never read-modify-write
- [ ] A `grantAccess` helper exists and is used by both the admin enroll route and task 12
- [ ] The existing admin enroll endpoint still behaves as before for its current callers
