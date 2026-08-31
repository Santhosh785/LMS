---
task: 14
name: deploy-hostinger-atlas
parallel_group: 5
depends_on: [11, 12, 13]
type: mechanical
---

# Task 14: Deploy to Hostinger VPS and MongoDB Atlas

## What to build

There is no deployment configuration of any kind — no Dockerfile, no CI, no process manager, no reverse proxy config. The only infrastructure artifact is a `docker-compose.yml` running `mongo:7` locally.

**Database — MongoDB Atlas.** Provision a cluster, restrict network access to the VPS address, and create an application user with least privilege. **Automated backups must be enabled** — this database holds every payment record and every customer's access rights, and a self-hosted instance with no backup story was rejected precisely for this reason. Verify a snapshot exists and can be listed before going live.

**Single origin.** `server/src/index.js` mounts API routes and never serves the client build; `README` assumes a separate web server for `client/dist`. Serve the built SPA from Express instead — static assets plus a catch-all fallback that returns `index.html` for non-API routes, ordered so it does not shadow `/api/*` or the existing `notFound` handler.

This is a deliberate choice: one origin means the auth cookie is same-site and the existing `sameSite: 'lax'` setting works untouched, with no CORS configuration to get wrong on launch night.

**Process and proxy.** Run the Node process under a supervisor that restarts on crash and starts on boot (PM2 or systemd). Put nginx in front on 80/443 with TLS from Let's Encrypt and automatic renewal, proxying to the Node port. Hostinger MCP tooling is available in-session to help configure the VPS.

**Verify the production-only settings actually engage.** Several behaviours are gated on `NODE_ENV`:

- `middleware/auth.js` sets the auth cookie `secure` flag only in production — confirm it is genuinely set on the live site
- `config/env.js` refuses to boot with the default `JWT_SECRET` in production — confirm the real secret is in place
- The task 3 seed guard must refuse to run against the production URI

**DNS.** Point the domain at the VPS and add the SPF and DKIM records documented by task 7, without which Resend will not deliver to real inboxes.

**Build.** The client builds via `vite build` to `client/dist`. Note it currently produces a single ~483KB bundle with no code splitting — that is accepted for launch and deferred deliberately.

Record the deployment steps somewhere durable. The next deploy will happen under time pressure and undocumented server state is how sites stay down.

## Acceptance criteria

- [ ] The site is reachable over HTTPS at the production domain with a valid, auto-renewing certificate
- [ ] Atlas is provisioned, network-restricted to the VPS, and automated backups are enabled and verified
- [ ] Express serves the SPA and the API from one origin; deep links like `/courses/seo-mastery` resolve on hard refresh
- [ ] `/api/*` routes are not shadowed by the SPA fallback
- [ ] The auth cookie carries `Secure` and `HttpOnly` on the live site
- [ ] The server refuses to boot with the default `JWT_SECRET`
- [ ] `npm run seed` against the production URI refuses to run
- [ ] The Node process restarts automatically after a crash and after a reboot
- [ ] SPF and DKIM verify, and a test email reaches an external inbox
- [ ] Deployment steps are written down
