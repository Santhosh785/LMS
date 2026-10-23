# Deployment — Coolify + Supabase

Production runs at **https://growthscholar.in** as a Coolify application on the
`relay` server (project `growthscholar`, app `growth-scholar-lms`). The database
and auth are Supabase (Postgres + Auth); there is no database on the server.

---

## How a deploy works

Coolify builds the repo's `main` branch with Railpack: the root `npm run build`
builds the client, and `npm start` runs Express (port 3000 in Coolify).
Express serves the pages and `/api/*` from one origin, so there is no CORS or
cross-site cookie setup. Coolify's Traefik proxy terminates TLS (Let's Encrypt)
and redirects `www` and `http` to the apex. Health check: `/api/health`.

**The client is server-rendered by the Express process** (React Router
framework mode). **No Coolify changes are required**: the build command is
still `npm run build`, the start command is still `npm start`, the port, health
check and proxy settings are unchanged, and no new service or volume is needed.

### Build output

`npm run build` (`react-router build`) writes two bundles to `client/build/`:

| Path | What it is |
| --- | --- |
| `client/build/server/index.js` | the server bundle Express imports at boot to render pages |
| `client/build/client/` | the browser assets: `assets/` (fingerprinted, served immutable for a year) and the files from `client/public` (served for an hour) |

The build output must exist at runtime, next to the server, in the same
container image. A start without it logs `client build missing` and answers
every page with the JSON 404. Vite is a build-time dependency only; in
production nothing imports it.

### Development workflow

```sh
npm run dev      # Express on :5000, with Vite embedded in middleware mode
```

One process serves the API and the pages from source, with hot reloading on the
same origin and port, so there is no client dev server, no proxy and no CORS
setup (`CLIENT_ORIGIN` defaults to the server's own origin). A production
build is only needed to test what Coolify runs: `npm run build && npm start`.
`npm run typecheck` generates the route types and runs `tsc` over the client.

Deploys are triggered from the Coolify dashboard (or its API). The GitHub
Actions workflow that redeployed on every push was removed, so whether a push
deploys depends only on Coolify's own auto-deploy setting for the app.

## Configuration

Environment variables live in the Coolify app, not in a file on the server.
`server/.env.example` lists every variable with comments. The ones production
cannot run without:

```
NODE_ENV=production
TRUST_PROXY=1                  # Traefik is the single hop. See env.trustProxy.
JWT_SECRET=                    # openssl rand -base64 48 (boot refuses without it; now only the fallback root for CONFIG_SECRET)
PUBLIC_URL=https://growthscholar.in
CLIENT_ORIGIN=https://growthscholar.in

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_PROJECT_REF=
DATABASE_URL=                  # pooler, transaction mode (:6543)
DIRECT_DATABASE_URL=           # direct (:5432) — migrations only

BUNNY_LIBRARY_ID=              # docs/bunny-stream.md
BUNNY_SECURITY_KEY=
RESEND_API_KEY=                # docs/email-dns.md
MAIL_FROM="Growth Scholar <no-reply@send.growthscholar.in>"
SUPPORT_EMAIL=support@growthscholar.in
BUSINESS_LEGAL_NAME=
BUSINESS_ADDRESS=
UPI_VPA=
UPI_PAYEE_NAME=
```

Never set `TEST_SUPABASE_PROJECT_REF` in production. The test suite truncates
every table in the project it runs against.

`TRUST_PROXY=1` matters more than it looks. Login, password-reset and checkout
rate limiting all key on `req.ip`. Behind an unacknowledged proxy every visitor
shares the proxy's IP and therefore one bucket, and the first five failed logins
lock out the world. Set it to the real hop count and no higher — extra hops are
client-spoofable through `X-Forwarded-For`.

**Rate-limit store.** The seven rate limiters (login, register, password reset
per IP and per email, checkout, blog comments, community reports) keep their
counters in Postgres, in a `rate_limit` schema shared by every instance, so the
sixth login attempt in a window is refused whichever instance answers it. Each
limiter counts under its own key prefix (`login`, `register`,
`password-reset-ip`, `password-reset-email`, `checkout`, `blog-comment`,
`community-report`), so one never spends another's budget. The store connects
with `DATABASE_URL` and works through the transaction pooler (:6543). Limits and
window lengths are unchanged, but the window is the package's: one fixed window
per limiter, started by the first hit after the previous one ended, rather than
a separate window per client as the memory store keeps.

`RATE_LIMIT_STORE` picks the store:

| Value      | Behaviour                                                       |
| ---------- | --------------------------------------------------------------- |
| `postgres` | Shared counters in Postgres. Requires `DATABASE_URL`.           |
| `memory`   | Per-process counters, as before. Correct only for one instance. |

Unset, it is `postgres` when `NODE_ENV=production` and `DATABASE_URL` is set,
and `memory` under test (`NODE_ENV=test`), in development, and whenever there
is no `DATABASE_URL`. An explicit value always wins; anything other than
`postgres` or `memory` stops the server at boot.

**Database privilege.** The store creates its schema, tables and functions on
first use (the migrations shipped in `@acpr/rate-limit-postgresql`, applied
once, in one transaction). The role in `DATABASE_URL` therefore needs
permission to create a schema in the database (`CREATE` on the database) and
objects in it, and the `uuid-ossp` extension must already exist or be creatable
by it. Supabase's `postgres` role has all of this. If the role must not hold
database-level `CREATE`, an admin pre-creates the schema for it instead —
`CREATE SCHEMA rate_limit AUTHORIZATION <app role>`, or
`GRANT USAGE, CREATE ON SCHEMA rate_limit TO <app role>` — and the store then
creates its tables and functions inside it on first use.

**Fail-open.** If the database is unreachable or a store query fails (connect
and query timeouts are 5 seconds), the request is let through **without** a
limit instead of being refused: a database outage must not also lock every user
out of logging in. Each failure is reported through the error path
(`[alert] Rate-limit store error` in the logs, and Sentry when configured),
throttled to one report a minute across all limiters, and the report counts how
many failures it stood in for.

`REPLICAS` (default 1) declares how many instances run. Admin edits to settings,
taxonomy and integrations reach every instance within a second or two over
Postgres `LISTEN/NOTIFY` (`gs_invalidate`, on `BOSS_DATABASE_URL` or else
`DIRECT_DATABASE_URL`), with the 60s cache TTL as the fallback. With
`REPLICAS` above 1 the server refuses to start unless Bunny Storage is
configured, because the local-disk media fallback is not shared between
instances.

**Background jobs and the edge cache.** Mail, payment side effects, sitemap
rebuilds and Cloudflare purges run on a pg-boss queue inside the Express
process. `BOSS_DATABASE_URL` (a session-capable connection, never the :6543
pooler; defaults to `DIRECT_DATABASE_URL`) and `BOSS_ENABLED=0` (run every job
inline) configure it; `CF_ZONE_ID` and `CF_API_TOKEN` enable the Cloudflare
purge after admin content changes and are no-ops when blank. See
[jobs.md](./jobs.md).

## Schema changes

```sh
npm --prefix server run db:generate          # writes server/drizzle/*.sql
cp server/drizzle/<new>.sql supabase/migrations/
supabase db push                             # against the production project
```

Push the migration **before** deploying code that depends on it. Keep changes
additive where possible so the previous build still runs if you roll back.

## DNS

DNS is managed in Hostinger hPanel. `A` records for `@` and `www` point at the
relay server. Keep the SPF, DKIM and DMARC records from
[email-dns.md](./email-dns.md) — without them Resend delivers only to the
account owner, and every buyer email (including the access link they paid for)
silently goes nowhere.

## Backups

The old Atlas snapshot plan no longer applies. Supabase's daily backups depend
on the plan the project is on — check Project Settings → Database → Backups and
confirm a recent backup is listed before relying on it.

## Verify after a deploy

```sh
# HTTPS and a valid, auto-renewing certificate
curl -sSI https://growthscholar.in | head -1
echo | openssl s_client -connect growthscholar.in:443 2>/dev/null | openssl x509 -noout -dates

# Single origin: deep links resolve on hard refresh, /api/* is not shadowed
curl -s -o /dev/null -w '%{http_code}\n' https://growthscholar.in/courses/seo-mastery   # 200 HTML
curl -s https://growthscholar.in/api/no-such-route                                       # JSON 404
curl -s https://growthscholar.in/api/health                                              # {"ok":true,…}

# The auth cookie is Secure and HttpOnly
curl -sSi -X POST https://growthscholar.in/api/auth/login \
  -H 'content-type: application/json' -d '{"email":"…","password":"…"}' | grep -i set-cookie

# The credential leak this project already shipped once
curl -s https://growthscholar.in/login | grep -c password123        # must be 0
grep -rc password123 client/build/client                             # must be 0

# The seed guard refuses production
NODE_ENV=production npm --prefix server run seed:demo                # must refuse, exit 1
```

Then walk the money path by hand: browse → checkout at ₹1 → approve in admin →
confirm the email arrives at an external address → sign in → play a lesson.

## Rollback

Redeploy the previous commit from Coolify (Deployments → pick the earlier one →
Redeploy). The database is not rolled back by this, so check that the older
build still reads the current schema before relying on it.

## Self-hosting without Coolify

`deploy/` (`deploy.sh`, `nginx.conf`, `growth-scholar.service`) and
`ecosystem.config.cjs` are the earlier plain-VPS route: PM2 or systemd behind
nginx, with `server/.env` on disk. They are not used in production any more but
still work if the app ever moves off Coolify.
