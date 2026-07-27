#!/usr/bin/env bash
# Bring up the starter kit's self-host stack in the right order: postgres
# healthy, then migrate (host-side, against the monorepo's own db tooling —
# `npx create-revealui`'s installer never wires this up automatically, so
# this script is what does), then api and admin.
#
# Run from examples/starter-kit/, with the full revealui monorepo checked
# out above it (docker-compose.starter.yml builds from apps/server/Dockerfile
# and apps/admin/Dockerfile in the repo root) and .env already populated
# (see .env.starter.example + scripts/generate-secrets.sh).
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

if [ ! -f .env ]; then
  echo "Missing .env. Copy .env.starter.example to .env and fill it in" >&2
  echo "(scripts/generate-secrets.sh generates the secret values)." >&2
  exit 1
fi

COMPOSE="docker compose -f docker-compose.starter.yml"

echo "==> Starting postgres"
$COMPOSE up -d postgres
echo "==> Waiting for postgres to report healthy"
until [ "$($COMPOSE ps --format json postgres 2>/dev/null | grep -c '"Health":"healthy"')" -ge 1 ]; do
  sleep 2
done

# Run migrations from the repo root, on the host, against the compose
# postgres exposed on localhost (POSTGRES_PORT, default 5432) — this is the
# step `npx create-revealui` sets up templates for but never runs itself.
echo "==> Running database migrations (host-side, pnpm db:migrate)"
(
  cd ../..
  set -a
  # shellcheck disable=SC1091
  source "examples/starter-kit/.env"
  set +a
  export POSTGRES_URL="postgresql://${POSTGRES_USER:-revealui}:${POSTGRES_PASSWORD}@localhost:${POSTGRES_PORT:-5432}/${POSTGRES_DB:-revealui}"
  pnpm db:migrate
)

echo "==> Starting api and admin"
$COMPOSE up -d api admin

echo "==> Done. Waiting on health checks:"
echo "    API health:   http://localhost:${API_PORT:-3004}/health"
echo "    Admin health: http://localhost:${CMS_PORT:-4000}/api/health"
echo "Once admin is healthy, log in at http://localhost:${CMS_PORT:-4000}/ with"
echo "REVEALUI_ADMIN_EMAIL / REVEALUI_ADMIN_PASSWORD from .env (first boot only)."
