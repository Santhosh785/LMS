# Deployment — Hostinger VPS + MongoDB Atlas (task 14)

The next deploy will happen under time pressure. Undocumented server state is how
sites stay down, so this is the whole sequence, including the parts that only
have to be done once.

**What is code and what is infrastructure.** Everything in `deploy/`,
`ecosystem.config.cjs` and the single-origin serving in `server/src/index.js` is
in the repository and verified. Sections 1, 2 and 6 below need an account, a
domain and a credit card — they have to be done by hand, in the Hostinger and
Atlas dashboards, by someone holding those credentials.

---

## 1. MongoDB Atlas

Atlas is non-negotiable regardless of where the app runs. This database holds
every payment record and every customer's access rights, and a self-hosted
instance with no backup story loses all of it to one disk failure.

1. **Create the cluster.** Atlas → Build a Database. `M10` or larger — the free
   `M0` tier has **no automated backups**, which defeats the entire reason for
   choosing Atlas. Region `ap-south-1` (Mumbai) to sit next to the VPS and the
   audience.
2. **Enable automated backups** and set a retention window. Cloud Backup →
   turn on → daily snapshot.
3. **Network access.** Atlas → Network Access → add the **VPS's static IP only**.
   Never `0.0.0.0/0`. Add your own IP temporarily if you need to inspect data,
   and remove it afterwards.
4. **Database user.** Atlas → Database Access → add a user with
   `readWrite` on the `growth-scholar` database only. Not `atlasAdmin`.
5. **Connection string** into `server/.env`:
   ```
   MONGO_URI=mongodb+srv://gs-app:<password>@cluster0.xxxxx.mongodb.net/growth-scholar?retryWrites=true&w=majority
   ```
   URL-encode the password if it contains `@ : / ? # [ ] %`.

**Verify a snapshot exists before announcing the URL** — Atlas → Backup →
Snapshots. An untested backup is a belief, not a backup. Take one on demand and
confirm it lists.

## 2. The VPS

Hostinger → VPS → Ubuntu 22.04 or 24.04.

```sh
# as root, once
adduser --system --group --home /opt/growth-scholar growthscholar
apt update && apt install -y nginx certbot python3-certbot-nginx git curl
curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt install -y nodejs
npm install -g pm2

ufw allow OpenSSH && ufw allow 'Nginx Full' && ufw enable
```

Get the code onto `/opt/growth-scholar` (git clone, or rsync from a workstation —
this plan is disk-only, with no GitHub remote, so rsync is the likely route):

```sh
rsync -av --exclude node_modules --exclude .git --exclude client/dist \
      ./ root@<vps-ip>:/opt/growth-scholar/
```

## 3. Configuration

Copy `server/.env.example` to `server/.env` on the server and fill it in. Nothing
here is ever committed.

```
NODE_ENV=production
PORT=5000
TRUST_PROXY=1                  # exactly one hop: nginx. See env.trustProxy.
MONGO_URI=mongodb+srv://…
JWT_SECRET=                    # openssl rand -base64 48
PUBLIC_URL=https://growthscholar.in
CLIENT_ORIGIN=https://growthscholar.in

SEED_PASSWORD=                 # openssl rand -base64 24
ADMIN_EMAIL=team@growthscholar.in

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

`TRUST_PROXY=1` matters more than it looks. Login, password-reset and checkout
rate limiting all key on `req.ip`. Behind an unacknowledged proxy every visitor
shares nginx's IP and therefore one bucket, and the first five failed logins lock
out the world. Set it to the real hop count and no higher — extra hops are
client-spoofable through `X-Forwarded-For`.

## 4. Process supervision

**PM2** (default):

```sh
cd /opt/growth-scholar
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup            # prints a command; run it to survive reboot
```

Single instance in `fork` mode on purpose: the rate-limit counters live in
process memory, so N cluster workers would mean N independent buckets and N times
the allowed login attempts.

**systemd** is the alternative — `deploy/growth-scholar.service`. Use one or the
other. Two supervisors racing for port 5000 produce a restart loop that reads
exactly like a crash.

## 5. nginx and TLS

```sh
cp deploy/nginx.conf /etc/nginx/sites-available/growthscholar.in
ln -s /etc/nginx/sites-available/growthscholar.in /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

certbot --nginx -d growthscholar.in -d www.growthscholar.in
systemctl status certbot.timer      # renewal is automatic; confirm it is active
certbot renew --dry-run
```

The **CSP is emitted by helmet in the Node process, not by nginx**, and it now
governs the rendered page because Express serves the SPA. Do not add a second CSP
in nginx — two policies intersect, and the failure mode looks like "the Bunny
player randomly stopped working".

## 6. DNS

| Type | Name | Value |
|---|---|---|
| `A` | `@` | the VPS IP |
| `A` | `www` | the VPS IP |

Plus the SPF, DKIM and DMARC records in
[email-dns.md](./email-dns.md). Without those, Resend delivers only to the
account owner and every buyer email silently goes nowhere — including the access
link they paid for.

## 7. Deploy

```sh
cd /opt/growth-scholar && ./deploy/deploy.sh
```

It installs, builds, greps the bundle for leaked credentials, publishes catalogue
content, runs the production data audit, reloads the process and waits for the
health check. It refuses to proceed on a missing or placeholder `JWT_SECRET`, and
aborts rather than restarting if the audit fails.

First deploy only, after the audit passes:

```sh
npm --prefix server run seed:admin     # the one real operator account
npm --prefix server run seed:prepare   # zero invented stats, draft what lacks video
```

Then attach Bunny video ids and publish courses through the admin console — see
[going-live-content.md](./going-live-content.md).

## 8. Verify before announcing the URL

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

# The process comes back
pm2 restart growth-scholar && sleep 3 && curl -s localhost:5000/api/health
sudo reboot          # then, after it comes up:
curl -s https://growthscholar.in/api/health
```

Then walk the money path by hand: browse → checkout at ₹1 → approve in admin →
confirm the email arrives at an external address → sign in → play a lesson.

## Rollback

```sh
cd /opt/growth-scholar
git log --oneline -5
git checkout <previous-sha>
./deploy/deploy.sh
```

The database is not rolled back by this. Schema changes so far are all additive
(`Enrollment.expiresAt`, `Course…bunnyVideoId`, the `Transaction` checkout
fields), so an older build reads newer documents without complaint — but check
that before relying on it after any future migration.

## Known limits, accepted for launch

- The client is a single ~550 KB bundle with no code splitting. Deliberately
  deferred; gzip brings it to ~155 KB.
- Rate limiting is in-process, so it does not survive a restart and does not
  work across multiple instances. Fine at one instance; a prerequisite to fix
  before scaling out.
