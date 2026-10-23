# Cloudflare — edge cache rollout

Cloudflare sits in front of **https://growthscholar.in** for two reasons:

- **Edge caching of anonymous public pages.** The server-rendered pages already
  send `Cache-Control: public, s-maxage=…, stale-while-revalidate=86400` for an
  anonymous visitor. With the cache rules below Cloudflare serves those from the
  edge, so a visitor never waits on Express and the origin does not render the
  same page twice.
- **Absorbing traffic spikes.** A launch email or a social post lands on the edge
  cache, not on the single Coolify server.

**Invariant: a logged-in user is never served from cache.** Responses to a
request that carries a session are `Cache-Control: private, no-store`, and the
first cache rule bypasses the cache outright for any request carrying the
session cookies. Both layers must stay: the rule protects against a bad header,
the header protects against a bad rule.

The pieces on our side already exist: the purge job (`CF_ZONE_ID`,
`CF_API_TOKEN`, [jobs.md](./jobs.md)) purges changed pages when an admin edits
content, and public pages emit their cache headers. This runbook does not change
either. It adds the `CF_PROXIED` flag for rate limiting behind the proxy.

Do the steps **in order**. Every step ends with something to check.

---

## 1. Before starting

Export or screenshot **every** existing DNS record at Hostinger (hPanel →
Domains → DNS Zone). At minimum:

- the apex `A` and the `www` record;
- `send` — the `MX` and the SPF `TXT`;
- `resend._domainkey` — the DKIM `TXT`;
- `_dmarc` — the DMARC `TXT`;
- any Google Workspace or Zoho mail records (`MX` on the apex, SPF on the apex,
  DKIM selectors, verification `TXT`s).

Keep the export; it is what step 2 is reconciled against and what the rollback
falls back on.

Lower the TTL of the records you can to 300 seconds (5 minutes), a day ahead
where possible, so a mistake is undone quickly.

Check: you have a saved list whose record count you can compare to Cloudflare's.

## 2. Add the site to Cloudflare

Cloudflare dashboard → **Add a site** → `growthscholar.in` → **Free** plan.
Cloudflare scans the existing DNS and proposes records. **The scan misses
records** (underscored names, DKIM selectors and anything not on a common
hostname), so reconcile the scanned list against the export from step 1 by hand,
record by record, and add what is missing.

Check: every record in the export exists in Cloudflare with the same type, name
and value.

## 3. Recreate DNS records

| Records                                                                               | Proxy status               |
| ------------------------------------------------------------------------------------- | -------------------------- |
| Apex `A` and `www` `A`, pointing at the Coolify server's IP                           | **Proxied (orange cloud)** |
| `TXT` on `send` (SPF), `TXT` on `resend._domainkey` (DKIM), `TXT` on `_dmarc` (DMARC) | **DNS only (grey cloud)**  |
| Every `MX` record (Resend's on `send`, and any Workspace/Zoho ones)                   | **DNS only (grey cloud)**  |
| Any `A` or `CNAME` used as a mail hostname (webmail, `mail.`, `smtp.`)                | **DNS only (grey cloud)**  |

`TXT` and `MX` records cannot be proxied anyway; the rule that matters is that
no A/CNAME used for mail goes through the proxy, because the proxy only carries
HTTP(S) and would break it. See [email-dns.md](./email-dns.md) for the exact
mail records.

Check: in the DNS tab only the apex and `www` show an orange cloud.

## 4. Move the nameservers

At the registrar (Hostinger hPanel → Domains → the domain → **Nameservers**),
replace the current nameservers with the two Cloudflare nameservers assigned to
the zone (shown on the zone's overview page).

Propagation can take **hours**. The zone shows **Active** in Cloudflare when it
is done, and Cloudflare emails the account owner. Nothing below should start
before then.

Check:

```sh
dig +short NS growthscholar.in      # the two Cloudflare nameservers
dig +short A  growthscholar.in      # Cloudflare addresses (proxied), not the server IP
```

## 5. SSL/TLS mode: Full (strict)

Cloudflare → SSL/TLS → Overview → **Full (strict)**.

- **Never Flexible.** Cloudflare would talk plain HTTP to Traefik, Traefik
  redirects HTTP to HTTPS, and every request loops.
- **Never Full (non-strict).** It encrypts to the origin but accepts any
  certificate, which is no protection against an impersonated origin.

Check: `curl -sSI https://growthscholar.in | head -1` answers `200` (not a
redirect loop or a 52x error).

## 6. Certificate renewal behind the proxy

Traefik's Let's Encrypt certificate must keep renewing with the proxy on.
Renewal needs a challenge to reach Traefik, and that path now goes through
Cloudflare.

1. Read the current expiry in Coolify (the app's domain / proxy view) and from
   the origin directly, bypassing Cloudflare:
   ```sh
   echo | openssl s_client -connect <server-ip>:443 -servername growthscholar.in 2>/dev/null \
     | openssl x509 -noout -dates
   ```
2. Let's Encrypt certificates renew about **30 days before expiry**. Note the
   expiry, work out the start of that renewal window, and **record a date to
   re-check** (see [Rollout status](#rollout-status)). On that date confirm the
   certificate's `notAfter` has moved forward.

If HTTP-01 fails behind the proxy, use these fallbacks **in this order**:

1. **DNS-01 challenge** using a Cloudflare API token scoped to **Zone → DNS →
   Edit** on this zone only. Configure it as Traefik's certificate resolver
   challenge. This is separate from the purge token in step 8; do not reuse one
   token for both.
2. **Cloudflare Origin CA certificate** installed in Traefik. It is valid only
   because the mode is Full (strict) and only Cloudflare trusts it, so the
   origin is then not browsable directly with a trusted certificate.

## 7. Cache Rules

Cloudflare → Caching → **Cache Rules**. Create these **in this order** — rule
order matters, and the bypass must come first.

1. **Bypass cache when the request carries a session.**
   - Expression: the `Cookie` header **contains** `gs_at` **or** the `Cookie`
     header **contains** `gs_rt`. These are the access and refresh cookie names
     set by the auth middleware (`server/src/middleware/auth.js`).
   - Action: **Bypass cache**.
2. **Make HTML cacheable and honour the origin.**
   - Expression: hostname **equals** `growthscholar.in`. (Do not add `www`:
     Traefik redirects `www` to the apex, so it serves no content.)
   - Action: **Eligible for cache**; **Edge TTL**: _Use cache-control header if
     present, bypass cache if not_; **Browser TTL**: _Respect origin TTL_.

The gotcha: on the free plan **HTML is not cached at all** unless a rule like
this one exists, because Cloudflare only caches static file extensions by
default. And if the origin's `Cache-Control` is not honoured, Cloudflare applies
its own TTL and overrides our headers, including the `private, no-store` on
logged-in responses and the purge-on-change freshness we rely on.

Check: the dashboard lists the bypass rule above the cache rule, and step 11
passes.

## 8. Purge credentials

The purge job ([jobs.md](./jobs.md)) needs a token that can purge and nothing
else.

1. Cloudflare → My Profile → API Tokens → **Create Token** → custom token with
   one permission: **Zone → Cache Purge → Purge**. Zone resources: **Include →
   Specific zone → growthscholar.in**.
2. Copy the zone ID from the zone's overview page.
3. In the Coolify app environment set `CF_ZONE_ID` and `CF_API_TOKEN`, then
   redeploy.

**Never commit them.** They live in Coolify only.

Check: after the redeploy the log no longer says
`[cloudflare] CF_ZONE_ID / CF_API_TOKEN not set`; step 11 covers the end-to-end
purge.

## 9. Client IP configuration

With Cloudflare in front there are **two** hops: Cloudflare to Traefik to
Express. Set `TRUST_PROXY=2` in the Coolify app environment (without Cloudflare
it stays `1`). Keep the existing rule: the real hop count and **no higher**,
because every extra hop is client-spoofable through `X-Forwarded-For`.

`TRUST_PROXY=2` only yields the real visitor IP if Traefik is configured to
trust Cloudflare's forwarded header; otherwise `req.ip` is a Cloudflare edge
address and many visitors share a rate-limit bucket. Pick **exactly one**:

- **Option A: Traefik trusted forwarded-header IPs.** Configure Traefik's
  entrypoint to trust Cloudflare's IP ranges for forwarded headers
  (`forwardedHeaders.trustedIPs`), so `X-Forwarded-For` carries the real client.
  Cloudflare's ranges are published at <https://www.cloudflare.com/ips/> and
  **change over time**, so the list must be kept current.
- **Option B: `CF_PROXIED=1`.** Set `CF_PROXIED=1` in the Coolify environment.
  Every rate limiter then keys on the `CF-Connecting-IP` header, falling back to
  `req.ip` when it is absent or empty, with IPv6 addresses bucketed by subnet
  (one shared helper, `server/src/middleware/clientKey.js`).

**Option B is only safe with origin ingress restricted to Cloudflare.**
`CF-Connecting-IP` is an ordinary request header: anyone who can reach the
origin directly can send any value and either dodge a limit or lock a victim
out. Before enabling `CF_PROXIED`, restrict the server's firewall (or the
provider's security group) so **ports 80 and 443 accept connections only from
Cloudflare's published IP ranges**, <https://www.cloudflare.com/ips-v4> and
<https://www.cloudflare.com/ips-v6>. Keep SSH and the Coolify ports on their own
rules. Re-check the ranges when Cloudflare announces a change.

Check: `curl -sI --resolve growthscholar.in:443:<server-ip> https://growthscholar.in`
from a machine outside the allowed ranges times out or is refused.

## 10. Verify the real client IP

1. Add a temporary log line where a limiter runs (for example in `clientKey()`)
   printing the resolved key and `req.ip` for one request. **Do not add a public
   echo endpoint**: it would hand out the header-spoofing surface this step
   exists to close.
2. Deploy, make one request from a machine whose public IP you know
   (`curl -s https://api.ipify.org`), and read the log.
3. Confirm the key is that machine's address and **not** a Cloudflare edge
   address (ranges in step 9).
4. **Remove the log line and redeploy.** Confirm it is gone from the code.

## 11. Verification checklist

Replace `<course-slug>` with a published course.

```sh
# Anonymous: first request MISS, second HIT, and our header intact.
curl -sI https://growthscholar.in/courses/<course-slug> | grep -iE 'cf-cache-status|cache-control'
curl -sI https://growthscholar.in/courses/<course-slug> | grep -iE 'cf-cache-status|cache-control'
# expect: cf-cache-status: MISS, then HIT; cache-control: public, s-maxage=…

# With a session cookie: never cached.
curl -sI -H 'Cookie: gs_at=x' https://growthscholar.in/courses/<course-slug> \
  | grep -iE 'cf-cache-status|cache-control'
# expect: cf-cache-status: BYPASS (or DYNAMIC); cache-control: private, no-store
```

(A real signed-in session shows `private, no-store` from the origin; a made-up
`gs_at` shows the Cloudflare bypass.)

Purge end to end: as an admin, publish a course (or edit a published one), then
repeat the anonymous `curl -sI` above. The next request must be `MISS`, the one
after it `HIT`.

Mail records are untouched by the move:

```sh
dig +short TXT resend._domainkey.growthscholar.in
dig +short MX  send.growthscholar.in
dig +short TXT _dmarc.growthscholar.in
```

All three must still answer, Resend must still show the domain as **Verified**,
and a test mail must pass SPF, DKIM and DMARC (view the original message in the
receiving mailbox).

Rate limiting per real client IP: send six failed `POST /api/auth/login`
requests from one machine and expect a `429` on the sixth; a request from a
different IP in the same window must not be limited.

```sh
for i in 1 2 3 4 5 6; do
  curl -s -o /dev/null -w '%{http_code}\n' -X POST https://growthscholar.in/api/auth/login \
    -H 'Content-Type: application/json' -d '{"email":"nobody@example.com","password":"wrong"}'
done
```

---

## Rollback

Fastest first; each step is safe to stop after.

1. In Cloudflare DNS set the apex and `www` `A` records to **DNS only (grey
   cloud)**. Traffic then goes straight to the origin and bypasses Cloudflare
   **immediately**, without waiting for any nameserver propagation (the records
   still resolve through Cloudflare's nameservers, just to the real IP).
   Check: `dig +short A growthscholar.in` returns the server IP, not a
   Cloudflare address.
2. Set `TRUST_PROXY` back to `1`, unset `CF_PROXIED`, and redeploy.

Everything else may stay in place harmlessly: the cache rules do nothing for
unproxied traffic, `CF_ZONE_ID` and `CF_API_TOKEN` can remain (the purge job
tolerates a zone that is not proxied), and the nameservers can stay at
Cloudflare. If the origin firewall was restricted to Cloudflare's ranges, open
ports 80 and 443 again, or the grey-cloud origin will be unreachable.

---

## Rollout status

**The rollout has not been executed yet.** The code (`CF_PROXIED`, the shared
rate-limit key) and this runbook are in place; no DNS, nameserver, Cloudflare or
production change has been made.

When the rollout is executed, the operator records here, as dated facts:

- the **completion date** (the day the zone showed Active and step 11 passed);
- the **next certificate re-check date** (about 30 days before the certificate's
  expiry, from step 6), and later the result of that re-check.
