---
task: 5
name: hide-nonfunctional-modules
parallel_group: 1
depends_on: []
type: ui
---

# Task 5: Hide the non-functional modules behind feature flags

## What to build

Three admin modules are complete, polished user interfaces backed by nothing. Shipping them would show customers fabricated data and silently drop real work.

**Gamification is inert.** `seeds` is written in exactly one place — the seeder. No route increments it. `PointRule` is edited by the admin UI and consumed by nothing. `LeaderboardEntry` is only ever written by the seeder. A real student sits at 0 seeds forever, earns no badges, and never appears on a leaderboard — while the leaderboard displays six fabricated students ranked above them.

**Funnels have no public surface.** There is no `/f/*` route anywhere in `client/src/App.jsx`. The step URLs in seed data point at pages that do not exist. `FunnelLead` is only ever created by the seeder, and `uniqueVisitors`/`totalViews` are hardcoded numbers in `server/src/seed/data/admin.js`. The module is a dashboard reporting invented analytics about pages that were never built.

**Email broadcasts send nothing.** `server/src/routes/admin/email.routes.js` records a send and its audience size with no mail transport attached — the code says so in a comment. Clicking Send marks a campaign sent and mails no one.

Introduce a feature-flag mechanism and use it to hide all three. Flags are read server-side from environment configuration (`server/src/config/env.js`) and exposed to the client — the `Setting` singleton already has a `menu` visibility block that is a natural fit.

Hide at three levels, all of them:

1. **Navigation** — remove the Marketing Funnels, Email and Gamification entries from the admin nav in `client/src/data/nav.js`
2. **Routes** — remove the corresponding `<Route>` blocks from `client/src/App.jsx` so deep links do not resolve
3. **API** — return 404 from `/api/admin/funnels`, `/api/admin/email/*` and `/api/admin/gamification/*` when the flag is off, so the endpoints are not reachable by a crafted request

**Keep all the source files.** This is reversible by design — the modules get built for real after launch, and deleting them would throw away working UI.

Also remove the student-facing surfaces fed by the dead gamification data: the badge and leaderboard panels in `client/src/pages/student/Achievements.jsx`, and the seeds/streak stat tiles on the student dashboard fed by `req.user.seeds` in `server/src/routes/me.routes.js`. These would display zero forever.

## Acceptance criteria

- [ ] Admin navigation shows no Funnels, Email or Gamification entries
- [ ] Navigating directly to `/admin/funnels`, `/admin/email/broadcasts` or `/admin/gamification/points` does not render those pages
- [ ] `curl` as an authenticated admin to `/api/admin/funnels`, `/api/admin/email/broadcasts` and `/api/admin/gamification/points` returns 404
- [ ] Flipping the flags back on restores all three modules with no code changes
- [ ] No source files for these modules were deleted
- [ ] The student achievements page and dashboard show no badge, leaderboard, or seeds figures
- [ ] The rest of the admin console — courses, customers, transactions, live, community, settings — is unaffected
