# Growth Scholar

An Express · React · Node app on Supabase (Postgres + Auth) — a rebuild of the original static
Growth Scholar site. Every page from the static build is here, backed by real
data, a real REST API, and real authentication instead of hardcoded markup.

The original static site is left untouched in `../Growth Scholar/` as the
visual reference.

---

## Quick start

```bash
# 1. install everything (root, server, client)
npm run install:all

# 2. point the server at a Supabase project (there is no local database).
#    Fill SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_PROJECT_REF,
#    DATABASE_URL (pooler :6543) and DIRECT_DATABASE_URL (:5432) — see the
#    comments in the file. Schema changes: `npm --prefix server run db:generate`,
#    copy the new drizzle/*.sql into supabase/migrations/, then `supabase db push`.
cp server/.env.example server/.env

# 3. load the catalogue content (13 courses, workshops, blog posts, channels…)
#    Idempotent, deletes nothing, safe to re-run.
npm run seed

# 4. add the demo accounts and sample activity (development only — this one
#    replaces the demo accounts and their enrollments, payments and
#    certificates, and refuses to run with NODE_ENV=production). Needs
#    SEED_PASSWORD in server/.env.
npm --prefix server run seed:demo

# 5. run the app
npm run dev
```

- App: <http://localhost:5000>
- API: <http://localhost:5000/api>

One process. Express renders the client with React Router (server-side
rendering) and, in development, runs Vite in middleware mode for hot reloading
— there is no separate client dev server, so `CLIENT_ORIGIN` is the server's
own origin and nothing is proxied.

### Tests

`npm run test:server` runs against the Supabase project named by
`TEST_SUPABASE_PROJECT_REF` — it must equal `SUPABASE_PROJECT_REF`, and the suite
refuses to run otherwise, because it wipes every table and auth identity between
tests. Never point it at production. Concurrent runs are serialised by an
advisory lock; use `npm --prefix server run db:lock -- <cmd>` for any other ad-hoc
command that writes to the shared dev project.

### Migrating data from MongoDB

`npm --prefix server run etl` copies a MongoDB database (`MONGO_URI`) into the
Postgres at `DIRECT_DATABASE_URL`, keeps passwords working (bcrypt hashes are
imported into Supabase Auth), and prints a verification report — it exits
non-zero on any mismatch. Read the header of `server/scripts/migrate-mongo-to-pg.js`
before running it against production.

### Seeded accounts

| Role            | Email                    |
| --------------- | ------------------------ |
| Student         | `priya.sharma@email.com` |
| Admin / creator | `team@growthscholar.in`  |

**The password is whatever you put in `SEED_PASSWORD`.** It is not printed here,
not printed by the seeder, and not hard-coded anywhere — the shared value that
used to live in this table also shipped on the live login page, which is the
whole reason it now comes from the environment:

```bash
# server/.env
SEED_PASSWORD="1234567890"
```

`npm --prefix server run seed:demo` refuses to run without it.

### The two halves of the seeder

| Command                               | What it does                                                                                                                                                                                                                                                                            |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run seed`                        | **Content.** Upserts courses, programs, workshops, posts, channels, practice items, badges and settings by natural key. Deletes nothing. Never touches accounts, enrollments, payments or certificates. Safe against production, repeatedly.                                            |
| `npm --prefix server run seed:demo`   | **Demo data.** DESTRUCTIVE — wipes accounts, enrollments, transactions, customers, leads and community content, then rebuilds the fabricated dataset. Refuses to run under `NODE_ENV=production`.                                                                                       |
| `npm --prefix server run seed:sample` | **Preview.** Content, then publishes it. The content seed creates courses as Draft (nothing has video attached), so a fresh database renders an empty catalogue — this is the switch that makes the public site look like a site. Non-destructive; refuses under `NODE_ENV=production`. |
| `npm --prefix server run seed:all`    | content, then demo — a full local dataset.                                                                                                                                                                                                                                              |
| `npm --prefix server run seed:help`   | the full usage, including the flags.                                                                                                                                                                                                                                                    |

Pass `-- --keep-users` to a demo seed to keep existing accounts.

Going live is a different sequence — `seed:admin`, `seed:prepare` and
`seed:audit`. See [docs/going-live-content.md](docs/going-live-content.md).

---

## Architecture

**One Express process serves everything on one origin**: the JSON API under
`/api`, and the web app, which React Router 7 (framework mode, `ssr: true`)
renders on the server. There is no separate client server in production or in
development, so the auth cookie stays same-site and there is no CORS setup.

- **Build.** `npm run build` runs `react-router build` and writes
  `client/build/server/index.js` (the server bundle Express imports at boot) and
  `client/build/client/` (the browser assets Express serves). Vite is a
  build-time and development dependency only.
- **Development.** `npm run dev` starts Express, which embeds Vite in
  middleware mode (HMR shares the app's port), so the pages hot-reload from
  source against the same origin as the API.
- **Mount order** (`server/src/index.js`): security headers and the CSP nonce →
  body and cookie parsing → `attachUser` → the `/api` routers → media uploads →
  legacy `.html` redirects → `/sitemap.xml` and `/robots.txt` →
  `middleware/reactRouter.js` (every other request) → the JSON 404. `/api/*` is
  passed through the page handler, so an unmatched API call gets JSON, never a
  page of HTML. Nothing from the client build is mounted under `NODE_ENV=test`.

### Server-rendered versus client-only routes

The route table is `client/src/routes.ts`; each route is a thin module under
`client/src/routes/` that wraps a page under `client/src/pages/`.

| Routes                                                                                                                                                                                                                                                                                                                                                                        | Rendering                                                                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Every route under the public layout except checkout — `/`, `/about`, `/courses`, `/courses/category`, `/courses/:slug`, `/programs/:slug`, `/programs/apply`, `/programs/fit-call`, `/workshops`, `/workshops/:slug`, `/blog`, `/blog/:slug`, `/resources/*`, `/login`, `/signup`, `/forgot-password`, `/reset-password`, the legal pages, `/contact`, and the not-found page | **SSR.** A route `loader` reads from the repos in the load context, the HTML arrives complete, and the route's own `meta()` writes the head (title, description, canonical, Open Graph, JSON-LD) through `@gs/seo`. Interactive parts (forms, the enrol button, comments) are TanStack Query / axios calls from the browser after hydration. |
| `/checkout/:slug`                                                                                                                                                                                                                                                                                                                                                             | **Client-only** body inside the server-rendered public chrome.                                                                                                                                                                                                                                                                               |
| `/student/*` (including the full-screen course player), `/community/*`, `/admin/*`                                                                                                                                                                                                                                                                                            | **Client-only.** The server renders a fallback block; the browser renders the page once the client loader has run. They sit behind `ProtectedRoute` and fetch with TanStack Query and axios.                                                                                                                                                 |

A route with no `meta()` of its own gets the root loader's head, which comes
from `resolveSeo` (`server/src/services/seo.js`, the URL-to-meta resolver; it
also supplies the document's status code, e.g. 404 for an unknown slug). The
client-only routes export a `meta()` with their title and a `noindex` robots
tag (`client/src/lib/clientMeta.ts`). The `<body>` class that scopes each
redesigned page's stylesheet comes from the route's `handle.bodyClass`, applied
in `root.tsx`.

### The load context

Every loader receives `context`, built per request by `getLoadContext` in
`server/src/middleware/reactRouter.js` (typed in
`client/src/types/load-context.d.ts`):

| Field         | What it is                                                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `repos`       | the repository modules under `server/src/db/repos`, so a loader queries the database directly instead of calling the API              |
| `user`        | the signed-in user in the shape `GET /api/auth/me` returns, or `null`                                                                 |
| `siteConfig`  | the cached `GET /api/config` payload (branding, menu, help, taxonomy, feature flags); default branding if the database is unreachable |
| `seo.resolve` | `resolveSeo(pathname, searchParams)`                                                                                                  |
| `nonce`       | this response's CSP nonce, for the inline scripts React Router emits                                                                  |

### Background jobs

Transactional mail, payment fulfilment side effects, sitemap regeneration and
Cloudflare cache purges run on a [pg-boss](docs/jobs.md) queue that lives in the
same Postgres (`pgboss` schema) and is worked inside the Express process — no
Redis, no second service. `BOSS_ENABLED=0` runs every job inline instead. See
[docs/jobs.md](docs/jobs.md).

### Caches

| Cache                                                                 | Where                                                                                            | Lifetime and invalidation                                                                                                                                                                                    |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Site config (`GET /api/config`, and `siteConfig` in the load context) | in process                                                                                       | 60 s TTL; cleared on every settings or taxonomy write, and on every instance over Postgres `LISTEN/NOTIFY` (`gs_invalidate`)                                                                                 |
| Runtime config (admin-entered integration values)                     | in process                                                                                       | same TTL and the same channel                                                                                                                                                                                |
| Sitemap                                                               | in process                                                                                       | 10 min; dropped on every instance by the `regenerate-sitemap` job, which also runs on a six-hourly cron                                                                                                      |
| Rate-limit counters                                                   | Postgres (`rate_limit` schema)                                                                   | shared by all instances; `RATE_LIMIT_STORE=memory` keeps them per process                                                                                                                                    |
| Rendered pages                                                        | HTTP `Cache-Control` from the loaders (`publicCache` in `server/src/middleware/cacheControl.js`) | anonymous visitors get `public, s-maxage=<n>, stale-while-revalidate=86400`; a signed-in visitor gets `private, no-store`. Login, signup, forgot-password and reset-password are always `private, no-store`. |
| API responses                                                         | none                                                                                             | every `/api` response is `no-store`, except `GET /api/config` (`public, s-maxage=60`)                                                                                                                        |
| Cloudflare edge                                                       | Cloudflare                                                                                       | the `purge-cloudflare-cache` job purges the affected URLs when an admin changes a course, program, workshop, post, setting or taxonomy term                                                                  |
| Static assets                                                         | browser                                                                                          | `/assets/*` (fingerprinted) is immutable for a year; other files in `client/public` for an hour                                                                                                              |

### Environment variables added with the SSR work

All are optional and documented in `server/.env.example`.

| Variable            | Purpose                                                                                                                                                                                                                                                                                                                      |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BOSS_DATABASE_URL` | Session-capable Postgres connection for pg-boss (direct `:5432` or the session-mode pooler, never `:6543`). Defaults to `DIRECT_DATABASE_URL`. The cache-invalidation listener uses it too when set.                                                                                                                         |
| `BOSS_ENABLED`      | `0` runs every job inline instead of on the queue. On otherwise, and always off under test.                                                                                                                                                                                                                                  |
| `RATE_LIMIT_STORE`  | `postgres` or `memory`. Unset: `postgres` in production when `DATABASE_URL` is set, `memory` otherwise.                                                                                                                                                                                                                      |
| `REPLICAS`          | How many instances run (default 1). Above 1 the server refuses to start without Bunny Storage configured.                                                                                                                                                                                                                    |
| `CF_ZONE_ID`        | Cloudflare zone whose cache is purged after content changes. Blank: the purge job does nothing.                                                                                                                                                                                                                              |
| `CF_API_TOKEN`      | Cloudflare API token with Zone > Cache Purge on that zone.                                                                                                                                                                                                                                                                   |
| `CF_PROXIED`        | Optional. `1` or `true` when the site is behind Cloudflare: every rate limiter keys on the `CF-Connecting-IP` header (falling back to the client IP, IPv6 by subnet). Requires restricting origin ingress to Cloudflare's IP ranges; see [docs/cloudflare.md](docs/cloudflare.md). With Cloudflare also set `TRUST_PROXY=2`. |

---

## Layout

```
growth-scholar-mern/
├── server/
│   └── src/
│       ├── index.js              express app, route mounting
│       ├── config/               env, database connection, observability, replica guard
│       ├── db/                   Drizzle schema, client, and repos that
│       │                         assemble rows into the API's document shape
│       ├── routes/               public, student, community
│       │   └── admin/            the guarded /api/admin tree
│       ├── middleware/           auth (Supabase session cookies), errors, validation,
│       │                         rate limiting, security headers, cache control,
│       │                         legacy redirects, reactRouter.js (the page handler)
│       ├── services/             site config, SEO resolver, sitemap, queue,
│       │                         invalidation, payments, media, runtime config
│       ├── jobs/                 pg-boss job definitions (mail, fulfilment,
│       │                         sitemap, Cloudflare purge)
│       ├── mail/                 transactional templates and sender
│       ├── seed/                 seed.js + data/ transcribed from the static HTML
│       └── utils/                csv helpers, generic CRUD router
├── packages/
│   └── seo/                      @gs/seo: page meta, JSON-LD and meta() descriptors
└── client/
    ├── react-router.config.ts    framework mode, ssr: true
    └── src/
        ├── root.tsx              the document, providers, fallback SEO meta from the root loader
        ├── routes.ts             the route table (legacy .html redirects live in the server)
        ├── routes/               one thin module per route: loader, meta, handle
        ├── entry.client.tsx      hydration
        ├── entry.server.tsx      streaming render
        ├── index.css             tailwind + the decorative gradients
        ├── layouts/              Public / Student / Community / Admin shells
        ├── components/           ui kit, plus public/ student/ community/ admin/
        ├── pages/                one folder per area
        ├── lib/                  loader helpers (*.server.ts), SEO and listing helpers
        ├── api/                  axios client + admin query hooks
        ├── hooks/                small UI hooks
        ├── context/              AuthContext, SiteConfigContext
        ├── styles/               the vendored redesign stylesheets
        ├── types/                load-context and server-module declarations
        └── data/                 nav trees, filter options, page furniture
```

---

## What maps to what

| Static site                               | This app                                                     |
| ----------------------------------------- | ------------------------------------------------------------ |
| `index.html`                              | `/`                                                          |
| `courses/index.html`                      | `/courses` — filtering now runs server-side, same URL params |
| `courses/marketing.html`                  | `/courses/category`                                          |
| `courses/seo.html`                        | `/courses/:slug`                                             |
| `programs/complete-growth-marketing.html` | `/programs/:slug`                                            |
| `workshops/*.html`                        | `/workshops`, `/workshops/:slug`                             |
| `blog/*.html`                             | `/blog`, `/blog/:slug`                                       |
| `student/*.html` (8 pages)                | `/student/*` — now behind auth                               |
| `community/*.html` (3 pages)              | `/community/*` — now behind auth                             |
| `admin/*.html` (34 pages)                 | `/admin/*` — now behind an admin role                        |
| —                                         | `/login`, `/signup` (new; the static site had no auth)       |

Old `.html` paths redirect to their new routes, so existing links keep working.

### Styling

The Tailwind theme in `client/tailwind.config.js` is the original CSS custom
property set, ported value-for-value — the same brand teal `#135855`, accent
`#3ecf8e`, radii, shadows, easing curve, Satoshi font stack and breakpoints.
The original stylesheets were desktop-first with `max-width` queries, so the
theme declares `mx-1100`, `mx-960`, `mx-640` and friends rather than
mobile-first `sm`/`md`/`lg`.

The ~125 decorative gradients (course thumbnails, banner washes) live in
`client/src/index.css` as plain CSS, deliberately outside `@layer components`:
a course's thumbnail class comes from the database at runtime, so Tailwind's
content scanner never sees it and would otherwise tree-shake the rule away.

---

## API

Everything is under `/api`. Public reads are open; writes and the admin tree
need a session. **Auth is Supabase Auth, proxied by Express**: the browser never
talks to Supabase. `/auth/login` and `/auth/register` sign the user in with
Supabase and store the session in two httpOnly `sameSite=lax` cookies (the
short-lived access token and the refresh token). The access token is verified on
each request against the project's published JWKS, an expired one is renewed
from the refresh cookie in place, and a password reset or suspension takes
effect on the next request. The same session is what the page loaders see as
`context.user`.

```
GET  /config                                     # branding, menu, help, taxonomy, feature flags
GET  /showcase                                   # the homepage rails, from tags flagged showAsRail
POST /auth/register  /auth/login  /auth/logout    GET /auth/me   PATCH /auth/me
POST /auth/forgot-password  /auth/reset-password   GET /auth/reset-password/:token
GET  /health
GET  /courses?price&type&topic&lang&category&tag&rating&duration&sort&q&limit
GET  /courses/:slug   /courses/facets
GET  /programs/:slug  /workshops  /workshops/:slug  /blog  /blog/:slug
POST /leads           /workshops/:id/register  /blog/:slug/comments
GET  /blog/:slug/comments  /courses/:slug/preview/:lessonId
GET  /resources/playbooks  /resources/playbooks/:slug  /resources/skills  /resources/skills/:slug
POST /resources/notify  /applications  /fit-calls
GET  /checkout/:slug      POST /checkout/upi  /checkout/razorpay/order  /checkout/razorpay/callback
POST /webhooks/razorpay  /webhooks/bunny

# student — requires a session
GET  /me/dashboard /me/enrollments /me/certificates /me/achievements /me/practice /me/bookings
POST /enrollments    PATCH /enrollments/:id/progress
GET  /enrollments/course/:slug  /enrollments/course/:slug/playback/:lessonId
GET  /live           POST /live/:id/book

# community — requires a session
GET  /channels  /feed  /channels/:slug/posts  /posts/:id/comments
POST /posts  /posts/:id/like  /posts/:id/comments  /reports  /blocks

# admin — requires role=admin on every route
GET   /admin/stats
CRUD  /admin/courses     PUT /admin/courses/:id/{settings,curriculum,pages,pricing,drip,automation}
      POST /admin/courses/:id/publish   GET /admin/courses/:id/students
      POST|GET|DELETE /admin/courses/:id/lessons/:lessonId/video   # Bunny upload presign / status / detach
CRUD  /admin/customers   POST /admin/customers/:id/enroll   GET /admin/customers/export
CRUD  /admin/transactions  POST /admin/transactions/:id/refund  GET /admin/transactions/export
CRUD  /admin/email/{broadcasts,lists,contacts}
      POST /admin/email/broadcasts/:id/send   POST /admin/email/contacts/import
CRUD  /admin/funnels     PUT /admin/funnels/:id/{steps,automation}
      GET /admin/funnels/:id/{overview,leads,leads/export}   GET /admin/funnels/leads
CRUD  /admin/live/{classes,bookings}   GET /admin/live/calendar
CRUD  /admin/gamification/badges  GET|PUT /admin/gamification/{points,settings}
      GET /admin/gamification/leaderboard?period=week|month|all
GET   /admin/community   CRUD /admin/community/channels
GET   /admin/settings    PUT /admin/settings/{branding,menu,help,domain}
CRUD  /admin/programs    PUT /admin/programs/:id/{information,copy,content,curriculum,pricing,faqs}
CRUD  /admin/leads       POST /admin/leads/:id/notes   GET /admin/leads/export
CRUD  /admin/workshops   GET /admin/workshops/{summary,registrations,registrations/export}
      PUT|DELETE /admin/workshops/registrations/:id
GET   /admin/integrations   PUT /admin/integrations/{features,payments,mail,video,business}
      POST /admin/integrations/{razorpay,mail,bunny}/test
CRUD  /admin/playbooks  /admin/skills   # resources
GET   /admin/applications  /admin/fit-calls   # flagship intake inboxes
CRUD  /admin/blog        /admin/media   # posts, comments, terms, media library
CRUD  /admin/users       POST /admin/users/:id/{suspend,reactivate,send-reset}
      GET /admin/users/export   DELETE /admin/users/:id?force=true
CRUD  /admin/taxonomy    GET /admin/taxonomy/taxonomies   GET /admin/taxonomy/:id/usage
      POST /admin/taxonomy/{reorder,merge}
      DELETE /admin/taxonomy/:id?replaceWith=<id>|force=true
```

`requireRole('admin')` is applied once, on the whole `/api/admin` router — the
client-side `<ProtectedRoute role="admin">` only mirrors it for UX. A
hand-crafted request from a student session still gets a 403.

### Taxonomy and runtime configuration

Categories, tags, course topics, languages, blog categories and workshop cities
live in one `Term` collection and are managed at `/admin/taxonomy`. Each term
carries a slug, an optional parent, an icon and colour, an explicit sort order,
SEO fields, and separate switches for **show in menu**, **show in filters**,
**show on cards** and **featured** — so a term can stay filterable while
dropping out of the header, or exist for internal tagging and appear nowhere.

Content documents store a term's **name**, not its id. That keeps the public
`?topic=SEO` URL contract intact and means no migration of existing courses,
posts or workshops. The trade is that renaming, merging or deleting a term has
to repoint every document referencing it — which `services/taxonomy.js` owns and
`tests/taxonomy.test.js` covers. Deleting a term that is still in use is refused
until you pick a replacement or explicitly confirm stripping it.

`GET /api/config` returns branding, menu visibility, support contacts, the
published taxonomy and the feature flags in one payload. The root
loader reads the same payload from the load context and hands it to
`context/SiteConfigContext.jsx`, so the server-rendered HTML already carries it
and editing a setting or a term changes the live site with no rebuild. The server
caches the payload in process and invalidates it on every settings or taxonomy
write (see [Caches](#caches)).

### Homepage rails and program page copy

The homepage's "New and popular" strip is three tags. Any tag flagged **show as
a homepage rail** becomes a column headed by the tag's name and filled with
whatever carries it — courses and programs both qualify, which is how the
flagship program sits in a rail beside courses. Curating the front page is
therefore tagging a course in Admin → Courses → Information, not editing
`Home.jsx`. A rail with nothing tagged into it does not render.

The program page's own furniture — every section eyebrow, heading and subhead,
plus each button's label and destination — lives in `Program.sectionCopy` and
`Program.ctas`, edited under **Admin → Programs → Page copy**. Fields are
addressed by key, so adding a section needs no schema change, and anything left
blank falls back to the wording in `client/src/data/programCopy.js` rather than
rendering a gap.

Run `npm run seed` to backfill the registry from whatever classification the
database already holds — it reproduces the previously hardcoded order exactly,
adds nothing twice, and never overwrites a term an operator has edited.

### Leads, registrations and accounts

Three surfaces that existed only as writes until now.

**Leads.** The mentor popup has been creating `Lead` records since launch that
no route ever read — every enquiry was invisible. `/admin/leads` lists them with
status, owner, follow-up date and a note trail. `convertedAt` is stamped once,
on the first move to Converted, so re-saving never moves the date.

**Workshop registrations.** `POST /api/workshops/:id/register` had the same
problem: people were signing up and nobody could see it. `/admin/workshops`
shows registered/attended/seats-left per session, lists accounts and guests
together, marks attendance, and exports the sheet. Removing a registration
decrements `registeredCount`, since the public page shows seats from it.

**Users.** There was no user list, role change or suspension, and admins existed
only via `seed:admin`. `/admin/users` covers all of it. Two guards run through
the routes: nobody may change their own role or suspend themselves, and the last
_active_ admin cannot be demoted, suspended or deleted — otherwise one click
locks everyone out of the panel.

Suspension is checked in `attachUser`, not just at login: the refresh cookie
lasts 30 days, so a login-only check would leave a suspended account working for
the rest of the month. Deleting an account with enrolments requires
`?force=true`; suspending keeps the purchase history.

### Configuration: admin vs environment

Most of what used to live in `server/.env` is editable at **`/admin/integrations`**:
feature flags, Razorpay and UPI details, the Resend key and from-address, Bunny
credentials, and the business identity that goes on invoices and policy pages.

**A value set in admin wins; a blank one falls back to the environment.** That
ordering is what makes this safe on a running deployment — until an operator
fills something in, every service behaves exactly as it did when it read `env`
directly. `services/runtimeConfig.js` owns the precedence and exposes plain
getters, so the payment, playback and mail paths stayed synchronous.

Secrets are sealed with AES-256-GCM (`utils/secretBox.js`) before they touch the
database, and the admin API returns only a masked hint (`••••4f2a`) plus where
the value is coming from. Submitting an empty string leaves a stored secret
alone — otherwise saving a form full of masked values would wipe the keys it
could not display; clearing one is an explicit action. The encryption root key
is `CONFIG_SECRET`, falling back to `JWT_SECRET` so existing deployments keep
working without a new value.

Each integration has a **Test** button that makes a real call — a key that is
merely present but wrong fails in the worst place, mid-checkout or on a password
reset nobody receives.

These **stay in `.env`** and cannot move, because they are needed before the
database is reachable or are what makes it trustworthy: the `SUPABASE_*` and
`DATABASE_URL`/`DIRECT_DATABASE_URL` values, `CONFIG_SECRET` (and `JWT_SECRET`,
still the fallback key for secrets stored before `CONFIG_SECRET` was set),
`PORT`, `NODE_ENV`, `TRUST_PROXY`, `CLIENT_ORIGIN`/`PUBLIC_URL`, `SENTRY_DSN`,
`RELEASE` and `SEED_PASSWORD` (CLI only).

### Feature flags

Three modules have finished UI and no behaviour behind it, so they ship hidden:

| Flag                   | Hides                                                                                                                         | Why it is off                                                           |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `FEATURE_FUNNELS`      | `/admin/funnels/*`, `/api/admin/funnels/*`                                                                                    | no public `/f/*` pages exist, so every view and lead figure is invented |
| `FEATURE_EMAIL`        | `/admin/email/*`, `/api/admin/email/*`                                                                                        | no mail transport: "Send" marks a campaign sent and mails no one        |
| `FEATURE_GAMIFICATION` | `/admin/gamification/*`, `/student/achievements`, `/api/admin/gamification/*`, `/api/me/achievements`, the seeds/streak tiles | nothing awards seeds, so a real learner sits at 0 forever               |

Set a flag to `1` in `server/.env` and restart: the admin nav entries, the
client routes and the API all come back. Nothing is deleted — the server reads
the flags in `config/env.js`, enforces them in `middleware/features.js`, and the
browser gets them from the site config in the root loader (`context/SiteConfigContext.jsx`).

---

## Notes on behaviour carried over

- **Catalog filtering** keeps the original URL contract exactly, including the
  quirk that "Paid" is pre-selected when the URL carries no facet at all, the
  9-per-page "View more" step, and the removable chip row. The filtering itself
  moved to the database.
- **Mentor popup** still fires 60 seconds in, opens instantly with `?mentor`,
  and stays dismissed for the rest of the session via
  `sessionStorage['gs_mentor_popup']`. Submissions now create a `Lead`.
- **The admin dashboard chart** is hand-written inline SVG, as it was
  originally — no charting library was added, so the look is unchanged.
- **Course modules** are called "modules" on the public course page and
  "sections" in the admin curriculum editor, matching the original wording.
  They are the same embedded documents.
- Seeded progress percentages are derived from the lessons actually marked
  complete, so the number does not jump the first time a learner clicks.

## Scripts

| Command               | What it does                                                                              |
| --------------------- | ----------------------------------------------------------------------------------------- |
| `npm run install:all` | install root + server + client                                                            |
| `npm run dev`         | Express on :5000, serving the client from source through embedded Vite                    |
| `npm run seed`        | publish catalogue content — idempotent, deletes nothing                                   |
| `npm run build`       | `react-router build`: the client and server bundles into `client/build`                   |
| `npm run typecheck`   | generate the route types and run `tsc` over the client                                    |
| `npm start`           | run Express, which server-renders the client from `client/build` on the same origin       |
| `npm test`            | build the client, then run the server test suite (needs a disposable database, see Tests) |
| `npm run lint`        | ESLint over both packages                                                                 |
| `npm run format`      | Prettier over both packages                                                               |
| `npm run test:server` | the server test suite alone, without building the client                                  |
| `npm run check`       | lint + format check + tests                                                               |

Deployment, email DNS, Bunny, Razorpay, mobile QA and observability each have a
runbook in [docs/](docs/).
