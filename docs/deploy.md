# Deployment — Coolify + Supabase

Production runs at **https://growthscholar.in** as a Coolify application on the
`relay` server (project `growthscholar`, app `growth-scholar-lms`). The database
and auth are Supabase (Postgres + Auth); there is no database on the server.

---

## How a deploy works

Coolify builds the repo's `main` branch with Railpack: the root `npm run build`
builds the client, and `npm start` runs Express (port 3000 in Coolify).
Express serves `client/dist` and `/api/*` from one origin, so there is no CORS
or cross-site cookie setup. Coolify's Traefik proxy terminates TLS (Let's
Encrypt) and redirects `www` and `http` to the apex. Health check:
`/api/health`.

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
JWT_SECRET=                    # openssl rand -base64 48
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

Run a **single instance**. The rate-limit counters live in process memory, so
N replicas would mean N independent buckets and N times the allowed login
attempts.

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
grep -rc password123 client/dist                                     # must be 0

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
