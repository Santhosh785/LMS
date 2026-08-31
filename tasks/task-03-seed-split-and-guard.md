---
task: 3
name: seed-split-and-guard
parallel_group: 1
depends_on: []
type: backend
---

# Task 3: Split the seeder and guard it against production

## What to build

`server/src/seed/seed.js` is a production kill switch. Around lines 37–47 it builds a list of 27 models and runs `deleteMany({})` across all of them — including `Enrollment`, `Transaction`, `Customer` and `Certificate` — with no `NODE_ENV` check and no confirmation prompt. Running `npm run seed` against the production database once destroys every paying customer's access, payment history and certificates. The existing `--keep-users` flag preserves accounts but still destroys everything those accounts bought.

Split the seeder into two clearly separated operations.

**`seedContent`** — the genuine catalogue: courses, programs, workshops, blog posts, community channels, practice items, badges and point rules, and the `Setting` singleton. This must be **idempotent**: upsert by natural key (`slug` for courses/programs/workshops/blog posts/channels, `key` for settings) rather than wiping and reinserting. It must be safe to run against production repeatedly to publish content updates, and it must never touch user-generated or transactional collections.

**`seedDemo`** — the fabricated data: the six demo users, transactions, customers, leads, funnel leads, leaderboard entries, workshop registrations, enrollments and certificates. This is development-only and may wipe freely.

**The guard.** `seedDemo` and any destructive path must refuse to run when `NODE_ENV === 'production'`, overridable only by an explicit, hard-to-type flag such as `--i-know-what-im-doing`. Refusal means exiting non-zero with a clear message naming the database it was about to destroy.

Update the `seed` script in `server/package.json` so the default invocation is the safe one, and expose the demo seed as a separate script. Keep the existing `--keep-users` behaviour available for local development.

The password used for demo users comes from `SEED_PASSWORD` — see task 2, which changes the same file. Coordinate rather than reverting each other's edit.

## Acceptance criteria

- [ ] `seedContent` and `seedDemo` are separately invocable
- [ ] Running `seedContent` twice in a row produces no duplicate courses, programs, workshops, blog posts or channels
- [ ] `seedContent` leaves existing `User`, `Enrollment`, `Transaction`, `Customer` and `Certificate` documents untouched
- [ ] `NODE_ENV=production npm run seed:demo` exits non-zero without deleting anything, and names the target database in its message
- [ ] The override flag is required, exact, and documented in the script's help output
- [ ] Local development can still get a full demo dataset in one command
