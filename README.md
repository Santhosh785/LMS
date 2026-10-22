# Growth Scholar — MERN

A MERN (MongoDB · Express · React · Node) rebuild of the original static
Growth Scholar site. Every page from the static build is here, backed by real
data, a real REST API, and real authentication instead of hardcoded markup.

The original static site is left untouched in `../Growth Scholar/` as the
visual reference.

---

## Quick start

```bash
# 1. install everything (root, server, client)
npm run install:all

# 2. point the server at your MongoDB
cp server/.env.example server/.env      # defaults to mongodb://127.0.0.1:27017/growth-scholar

# 3. load the catalogue content (13 courses, workshops, blog posts, channels…)
#    Idempotent, deletes nothing, safe to re-run.
npm run seed

# 4. add the demo accounts and sample activity (development only — this one
#    WIPES accounts, enrollments, payments and certificates first, and refuses
#    to run with NODE_ENV=production). Needs SEED_PASSWORD in server/.env.
npm --prefix server run seed:demo

# 5. run both apps
npm run dev
```

- Client: <http://localhost:5173>
- API: <http://localhost:5000/api>

Vite proxies `/api` to the Express server, so there is nothing to configure on
the client side.

### Seeded accounts

| Role | Email |
|---|---|
| Student | `priya.sharma@email.com` |
| Admin / creator | `team@growthscholar.in` |

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

| Command | What it does |
|---|---|
| `npm run seed` | **Content.** Upserts courses, programs, workshops, posts, channels, practice items, badges and settings by natural key. Deletes nothing. Never touches accounts, enrollments, payments or certificates. Safe against production, repeatedly. |
| `npm --prefix server run seed:demo` | **Demo data.** DESTRUCTIVE — wipes accounts, enrollments, transactions, customers, leads and community content, then rebuilds the fabricated dataset. Refuses to run under `NODE_ENV=production`. |
| `npm --prefix server run seed:sample` | **Preview.** Content, then publishes it. The content seed creates courses as Draft (nothing has video attached), so a fresh database renders an empty catalogue — this is the switch that makes the public site look like a site. Non-destructive; refuses under `NODE_ENV=production`. |
| `npm --prefix server run seed:all` | content, then demo — a full local dataset. |
| `npm --prefix server run seed:help` | the full usage, including the flags. |

Pass `-- --keep-users` to a demo seed to keep existing accounts.

Going live is a different sequence — `seed:admin`, `seed:prepare` and
`seed:audit`. See [docs/going-live-content.md](docs/going-live-content.md).

---

## Layout

```
growth-scholar-mern/
├── server/
│   └── src/
│       ├── index.js              express app, route mounting
│       ├── config/               env + mongo connection
│       ├── models/               28 mongoose models
│       ├── routes/               public, student, community
│       │   └── admin/            the guarded /api/admin tree
│       ├── middleware/           auth (JWT cookie), errors, validation
│       ├── seed/                 seed.js + data/ transcribed from the static HTML
│       └── utils/                csv helpers, generic CRUD router
└── client/
    └── src/
        ├── App.jsx               the whole route tree + legacy .html redirects
        ├── index.css             tailwind + the decorative gradients
        ├── layouts/              Public / Student / Community / Admin shells
        ├── components/           ui kit, plus public/ student/ community/ admin/
        ├── pages/                one folder per area
        ├── api/                  axios client + admin query hooks
        ├── context/              AuthContext
        └── data/                 nav trees, filter options, page furniture
```

---

## What maps to what

| Static site | This app |
|---|---|
| `index.html` | `/` |
| `courses/index.html` | `/courses` — filtering now runs server-side, same URL params |
| `courses/marketing.html` | `/courses/category` |
| `courses/seo.html` | `/courses/:slug` |
| `programs/complete-growth-marketing.html` | `/programs/:slug` |
| `workshops/*.html` | `/workshops`, `/workshops/:slug` |
| `blog/*.html` | `/blog`, `/blog/:slug` |
| `student/*.html` (8 pages) | `/student/*` — now behind auth |
| `community/*.html` (3 pages) | `/community/*` — now behind auth |
| `admin/*.html` (34 pages) | `/admin/*` — now behind an admin role |
| — | `/login`, `/signup` (new; the static site had no auth) |

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
are guarded by a JWT in an httpOnly `sameSite=lax` cookie.

```
GET  /config                                     # branding, menu, help, taxonomy, feature flags
GET  /showcase                                   # the homepage rails, from tags flagged showAsRail
POST /auth/register  /auth/login  /auth/logout    GET /auth/me   PATCH /auth/me
GET  /courses?price&type&topic&lang&category&tag&rating&duration&sort&q&limit
GET  /courses/:slug   /courses/facets
GET  /programs/:slug  /workshops  /workshops/:slug  /blog  /blog/:slug
POST /leads           /workshops/:id/register

# student — requires a session
GET  /me/dashboard /me/enrollments /me/certificates /me/achievements /me/practice
POST /enrollments    PATCH /enrollments/:id/progress
GET  /enrollments/course/:slug
GET  /live           POST /live/:id/book

# community — requires a session
GET  /channels  /feed  /channels/:slug/posts  /posts/:id/comments
POST /posts  /posts/:id/like  /posts/:id/comments

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
published taxonomy and the feature flags in one payload. The client reads it
once at boot through `context/SiteConfigContext.jsx`, so editing a setting or a
term changes the live site with no rebuild. The server caches the payload in
process and invalidates it on every settings or taxonomy write.

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
*active* admin cannot be demoted, suspended or deleted — otherwise one click
locks everyone out of the panel.

Suspension is checked in `attachUser`, not just at login: the auth cookie lasts
seven days, so a login-only check would leave a suspended account working for
the rest of the week. Deleting an account with enrolments requires
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
database is reachable or are what makes it trustworthy: `MONGO_URI`,
`JWT_SECRET`, `CONFIG_SECRET`, `PORT`, `NODE_ENV`, `TRUST_PROXY`,
`CLIENT_ORIGIN`/`PUBLIC_URL`, `SENTRY_DSN`, `RELEASE`, `JWT_EXPIRES_IN` and
`SEED_PASSWORD` (CLI only).

### Feature flags

Three modules have finished UI and no behaviour behind it, so they ship hidden:

| Flag | Hides | Why it is off |
|---|---|---|
| `FEATURE_FUNNELS` | `/admin/funnels/*`, `/api/admin/funnels/*` | no public `/f/*` pages exist, so every view and lead figure is invented |
| `FEATURE_EMAIL` | `/admin/email/*`, `/api/admin/email/*` | no mail transport: "Send" marks a campaign sent and mails no one |
| `FEATURE_GAMIFICATION` | `/admin/gamification/*`, `/student/achievements`, `/api/admin/gamification/*`, `/api/me/achievements`, the seeds/streak tiles | nothing awards seeds, so a real learner sits at 0 forever |

Set a flag to `1` in `server/.env` and restart: the admin nav entries, the
client routes and the API all come back. Nothing is deleted — the server reads
the flags in `config/env.js`, enforces them in `middleware/features.js`, and the
browser reads them once from `GET /api/config` (`context/FeatureContext.jsx`).

---

## Notes on behaviour carried over

- **Catalog filtering** keeps the original URL contract exactly, including the
  quirk that "Paid" is pre-selected when the URL carries no facet at all, the
  9-per-page "View more" step, and the removable chip row. The filtering itself
  moved to MongoDB.
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

| Command | What it does |
|---|---|
| `npm run install:all` | install root + server + client |
| `npm run dev` | Express on :5000 and Vite on :5173 together |
| `npm run seed` | publish catalogue content — idempotent, deletes nothing |
| `npm run build` | production build of the client into `client/dist` |
| `npm start` | run the API, which also serves `client/dist` on the same origin |
| `npm test` | build the client, then run the money-path test suite |
| `npm run lint` | ESLint over both packages |
| `npm run format` | Prettier over both packages |
| `npm run check` | lint + format check + tests |

Deployment, email DNS, Bunny, Razorpay, mobile QA and observability each have a
runbook in [docs/](docs/).
