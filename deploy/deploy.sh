#!/usr/bin/env bash
#
# Deploy the current checkout on the VPS. Run it *on the server*, from the repo
# root, as the user that owns the process:
#
#   ./deploy/deploy.sh
#
# The next deploy will happen under time pressure, which is exactly when a
# half-remembered sequence goes wrong. This is that sequence.

set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

say() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

# --- preflight -------------------------------------------------------------
[[ -f server/.env ]] || die "server/.env is missing — copy .env.example and fill it in"

# Refuse to deploy with the development JWT secret. config/env.js also refuses
# to boot, but failing here means the old process is still serving traffic
# rather than a new one crash-looping.
if grep -qE '^JWT_SECRET=(change-me-to-a-long-random-string)?$' server/.env; then
  die "JWT_SECRET is unset or still the placeholder in server/.env"
fi
grep -q '^NODE_ENV=production' server/.env || say "WARNING: NODE_ENV is not production in server/.env"

# --- build -----------------------------------------------------------------
say "Installing dependencies"
npm --prefix server ci --omit=dev
npm --prefix client ci

say "Building the client"
npm --prefix client run build
[[ -f client/dist/index.html ]] || die "client build produced no dist/index.html"

# The credential leak this project already shipped once. A grep is cheap;
# task 20 turns it into a test that fails the suite.
say "Checking the bundle for leaked credentials"
if grep -rqE 'password123|SEED_PASSWORD|BUNNY_SECURITY_KEY|RESEND_API_KEY|rzp_live' client/dist; then
  die "a credential appears in client/dist — do NOT deploy this build"
fi

# --- publish content -------------------------------------------------------
say "Publishing catalogue content (idempotent, touches no customer data)"
NODE_ENV=production npm --prefix server run seed

say "Auditing production data"
NODE_ENV=production npm --prefix server run seed:audit || die "audit failed — see above"

# --- restart ---------------------------------------------------------------
mkdir -p logs
if command -v pm2 >/dev/null 2>&1 && pm2 describe growth-scholar >/dev/null 2>&1; then
  say "Reloading under PM2"
  pm2 reload ecosystem.config.cjs --env production --update-env
  pm2 save
else
  say "Restarting the systemd unit"
  sudo systemctl restart growth-scholar
fi

# --- verify ----------------------------------------------------------------
say "Waiting for the health check"
for i in $(seq 1 20); do
  if curl -fsS http://127.0.0.1:5000/api/health | grep -q '"ok":true'; then
    say "Healthy. Deploy complete."
    curl -fsS http://127.0.0.1:5000/api/health; echo
    exit 0
  fi
  sleep 1
done

die "the app did not report healthy within 20s — check logs/error.log or 'pm2 logs'"
