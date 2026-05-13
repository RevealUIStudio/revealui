#!/usr/bin/env bash
# Zero the POSTGRES_URL in the drizzle-studio env file. Run after a
# prod session so the credential doesn't sit at rest until the next
# start. Safe to run when the service is stopped or running (the
# next start will read the empty value and fail-fast).
set -euo pipefail

ENV_FILE="$HOME/.config/drizzle-studio/env"

if [ ! -f "$ENV_FILE" ]; then
  echo "No env file at $ENV_FILE; nothing to clear."
  exit 0
fi

umask 0177
cat > "$ENV_FILE" <<EOF
# Cleared by clear-env.sh at $(date -Iseconds)
# Re-populate via start-prod.sh or by editing this file directly.
POSTGRES_URL=
EOF
chmod 0600 "$ENV_FILE"
echo "✓ Cleared POSTGRES_URL in $ENV_FILE"
