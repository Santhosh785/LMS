---
task: 18
name: data-integrity-fixes
parallel_group: 6
depends_on: [14]
type: backend
---

# Task 18: Data integrity fixes

## What to build

A set of independent correctness defects found during the codebase audit. None is individually urgent, and together they are the difference between data you can trust and data you cannot.

**Orphaned comments on channel deletion.** `server/src/routes/admin/community.routes.js` (around line 61) deletes a channel and its posts with `Post.deleteMany({ channelId })`, but never deletes the comments belonging to those posts. Every channel deletion leaves permanently unreachable comment documents. Collect the post ids before deletion and remove their comments too. Audit the other delete paths for the same class of bug.

**Duplicate workshop registrations.** `server/src/routes/workshop.routes.js` creates a `WorkshopRegistration` on every POST with no check for an existing one, so a user can register repeatedly for the same workshop and inflate `registeredCount` each time. Add a unique compound index on workshop and user, and make the endpoint idempotent — return the existing registration rather than erroring. Note guest registrations have no user id, so the index needs to handle that case without blocking multiple guests.

**N+1 in CSV contact import.** `server/src/routes/admin/email.routes.js` (around lines 60–74) loops over CSV rows and runs `EmailContact.findOne({ email })` inside the loop — a thousand-row import is a thousand round trips. Batch-fetch existing contacts with a single `$in` query, build a lookup map, then bulk write. Also validate email format per row, which it currently does not.

This endpoint sits behind a feature flag from task 5. Fix it anyway — it will be re-enabled when the email module is built for real.

**Missing indexes.** `Broadcast.status` is filtered but unindexed. `LeaderboardEntry` is queried by period and board with no compound index. `Transaction` has separate indexes on status and date but is commonly filtered by both together. Add compound indexes matching the actual query shapes, and confirm with `explain()` rather than assuming.

**Verify the atomic counter fixes hold.** Task 6 replaced read-modify-write on `enrolledCount`, `commentCount` and `registeredCount` with `$inc`. Sweep for any remaining instance of the pattern — a counter read, incremented in JavaScript, then saved — and convert it.

## Acceptance criteria

- [ ] Deleting a channel removes its posts and their comments, with no orphans
- [ ] Other cascade paths were audited and any equivalent orphaning fixed
- [ ] A unique index prevents duplicate workshop registrations for the same user
- [ ] Re-registering returns the existing registration and does not inflate `registeredCount`
- [ ] Guest registrations still work and are not blocked by the index
- [ ] CSV import performs a constant number of queries regardless of row count
- [ ] CSV import rejects rows with malformed emails and reports them
- [ ] A 1000-row import completes in a reasonable time, measured before and after
- [ ] Compound indexes exist for the broadcast, leaderboard and transaction query shapes, confirmed by `explain()`
- [ ] No read-modify-write counter updates remain anywhere in the codebase
