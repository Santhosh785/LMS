---
task: 1
name: git-init-and-secrets
parallel_group: 1
depends_on: []
type: mechanical
---

# Task 1: Version control and production secrets

## What to build

The project has never been under version control and its production secrets do not exist yet. Everything else in this plan assumes both.

**Version control.** Initialise a git repository at the `growth-scholar-mern/` directory — the folder holding `.gitignore`, `docker-compose.yml`, and both `client/` and `server/`. The existing `.gitignore` already excludes `node_modules/`, `dist/`, `.env`, `.env.local`, `*.log` and `.DS_Store`; verify that before the first commit and confirm no `.env` file is staged. Commit the entire current state as a baseline so every later task is revertible. No remote is configured — this was a deliberate decision, not an oversight.

**Production secrets.** The app currently runs on development defaults that are unsafe in production. `server/src/config/env.js` already throws on startup when `NODE_ENV=production` and `JWT_SECRET` is still the default `dev-only-insecure-secret` — keep that guard, it is correct.

Produce a production environment configuration containing:

| Variable | Notes |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | as required by the host |
| `MONGO_URI` | MongoDB Atlas connection string (task 14 provisions the cluster; a placeholder is fine here) |
| `JWT_SECRET` | freshly generated, 32+ random bytes, never the default |
| `JWT_EXPIRES_IN` | keep the existing `7d` |
| `CLIENT_ORIGIN` | the production origin |
| `SEED_PASSWORD` | consumed by task 3 so the seeder stops hardcoding a password |
| `BUNNY_LIBRARY_ID`, `BUNNY_SECURITY_KEY` | consumed by task 8 |
| `RESEND_API_KEY`, `MAIL_FROM` | consumed by task 7 |
| `UPI_VPA`, `UPI_PAYEE_NAME` | consumed by task 10 |

Extend `server/.env.example` with every new variable name (no values) so the template stays honest. Extend `server/src/config/env.js` to read and export the new variables, following the existing pattern in that file.

Do not commit any real secret values.

## Acceptance criteria

- [ ] `git rev-parse --show-toplevel` resolves to the `growth-scholar-mern/` directory
- [ ] A baseline commit exists containing the full current source tree
- [ ] `git status` shows no `.env` file tracked or staged, and no `node_modules/` or `dist/`
- [ ] `server/.env.example` lists every variable above, values omitted
- [ ] `server/src/config/env.js` exports the new variables alongside the existing ones
- [ ] Starting the server with `NODE_ENV=production` and the default `JWT_SECRET` still refuses to boot
- [ ] Starting the server in development with no `.env` changes still works exactly as before
