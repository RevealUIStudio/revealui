#!/usr/bin/env bash
# Bring up the starter kit's Postgres and wait for it to report healthy.
#
# This script does NOT build or start the RevealUI app — the app comes from
# `npm create revealui@latest`, which installs the framework from the public
# npm registry. See GETTING-STARTED.md for the full flow. This script covers
# the one piece npm cannot give you: a Postgres with the `vector` extension
# available, which RevealUI's first migration requires.
#
# Run from examples/starter-kit/ with .env already populated
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
for _ in $(seq 1 60); do
  if [ "$($COMPOSE ps --format json postgres 2>/dev/null | grep -c '"Health":"healthy"')" -ge 1 ]; then
    healthy=1
    break
  fi
  sleep 2
done

if [ "${healthy:-0}" -ne 1 ]; then
  echo "postgres did not become healthy within ~2 minutes." >&2
  echo "Check '$COMPOSE logs postgres' for the cause." >&2
  exit 1
fi

# shellcheck disable=SC1091
set -a
source .env
set +a

echo
echo "==> Postgres is up and healthy."
echo
echo "Point your RevealUI app at it with this POSTGRES_URL:"
echo
echo "    postgresql://${POSTGRES_USER:-revealui}:<POSTGRES_PASSWORD>@localhost:${POSTGRES_PORT:-5432}/${POSTGRES_DB:-revealui}"
echo
echo "Next steps (from GETTING-STARTED.md):"
echo "    npm create revealui@latest my-app"
echo "    cd my-app"
echo "    # copy POSTGRES_URL above into my-app/.env"
echo "    pnpm install && pnpm db:migrate && pnpm dev"
echo
echo "Your app will be on http://localhost:4000/."
