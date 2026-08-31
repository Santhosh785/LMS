---
task: 2
name: security-blockers
parallel_group: 1
depends_on: []
type: backend
---

# Task 2: Security blockers

## What to build

Three defects that make the site unsafe to expose publicly. This task must not be cut.

**1. The login page publishes the admin password.** `client/src/pages/public/Login.jsx` renders a "Seeded demo accounts" panel (around lines 53–58) showing `Student: priya.sharma@email.com / password123` and `Admin: team@growthscholar.in / password123` to every visitor. On a live site this is full admin compromise for anyone who reads the page. Delete the panel entirely.

**2. The seeded admin password is `password123`.** Even with the panel gone, the credential is guessable and appears in the repository. `server/src/seed/seed.js` hardcodes it (around line 51). Replace the literal with a read from `process.env.SEED_PASSWORD`, and fail loudly if that variable is unset rather than silently falling back to a weak default.

**3. No security headers and no brute-force protection.** `server/src/index.js` mounts morgan, cors, json, urlencoded, cookie-parser and `attachUser`, and nothing else. There is no `helmet` and no rate limiting anywhere, so the login endpoint accepts unlimited password attempts.

Add both:

- `helmet` applied globally, mounted early in the middleware chain. Its default Content-Security-Policy is likely to block the Bunny video iframe added in task 11 and the Fontshare font CDN already used — configure CSP to permit those origins rather than disabling helmet's CSP wholesale.
- `express-rate-limit` on the authentication endpoints only: roughly 5 attempts per 15 minutes per IP on `POST /api/auth/login` and `POST /api/auth/register`. Do not rate-limit the whole API — `GET /api/auth/me` is called on every page load and would trip immediately.

Both packages are new dependencies in `server/`.

## Acceptance criteria

- [ ] The rendered `/login` page contains no email address, no password, and no "seeded demo accounts" text
- [ ] `grep -r "password123" client/ server/ --exclude-dir=node_modules` returns nothing
- [ ] The seeder reads its password from `SEED_PASSWORD` and exits with a clear error when it is unset
- [ ] Responses carry helmet's security headers (verify `X-Content-Type-Options` and `X-Frame-Options` are present)
- [ ] The Bunny video iframe and the existing Fontshare font both still load with CSP active
- [ ] The 6th login attempt within 15 minutes from one IP is rejected with 429
- [ ] `GET /api/auth/me` is unaffected by rate limiting across normal browsing
