#!/usr/bin/env bash
# Start drizzle-studio against the prod Neon DB.
#
# Fetches the prod POSTGRES_URL from revvault (PTY-wrapped to bypass
# revvault's non-TTY suppression), writes it to the user env file at
# mode 0600, then starts the systemd-user unit.
#
# When you're done with the session:
#   systemctl --user stop drizzle-studio
#   bash packages/db/systemd/clear-env.sh    # zeroes POSTGRES_URL
#
# Prerequisites:
#   - revvault is installed and unlocked
#   - install.sh has run at least once (unit file present)
set -euo pipefail

ENV_FILE="$HOME/.config/drizzle-studio/env"
REVVAULT_PATH="${REVVAULT_PATH:-revealui/prod/neon/postgres-url}"

# 1. Confirm the unit is installed.
if ! systemctl --user list-unit-files drizzle-studio.service >/dev/null 2>&1; then
  echo "✗ drizzle-studio.service not installed. Run packages/db/systemd/install.sh first." >&2
  exit 1
fi

# 2. Pull POSTGRES_URL from revvault using a PTY (revvault suppresses
#    output when stdin/stdout aren't a TTY).
TMP_RAW="$(mktemp)"
trap 'rm -f "$TMP_RAW"' EXIT
script -qc "revvault get $REVVAULT_PATH" "$TMP_RAW" >/dev/null 2>&1
POSTGRES_URL="$(
  sed 's/\x1b\[[0-9;]*[a-zA-Z]//g; s/\r//g' "$TMP_RAW" | \
  grep -oE 'postgresql://[^[:space:]]+' | head -1
)"

if [ -z "$POSTGRES_URL" ]; then
  echo "✗ Could not fetch POSTGRES_URL from revvault at: $REVVAULT_PATH" >&2
  echo "  Check that revvault is unlocked and the path exists." >&2
  exit 2
fi

# 3. Write env file with mode 0600.
mkdir -p "$(dirname "$ENV_FILE")"
chmod 0700 "$(dirname "$ENV_FILE")"
umask 0177  # ensures created file is 0600
cat > "$ENV_FILE" <<EOF
# Populated by start-prod.sh at $(date -Iseconds)
# Source: revvault $REVVAULT_PATH
# Clear when done: bash packages/db/systemd/clear-env.sh
POSTGRES_URL=$POSTGRES_URL
EOF
echo "✓ Wrote $ENV_FILE (mode 0600) with prod POSTGRES_URL"

# 4. Start (or restart if already up).
systemctl --user restart drizzle-studio
sleep 2
if systemctl --user is-active --quiet drizzle-studio; then
  PORT="$(ss -tlnp 2>/dev/null | grep 4983 | head -1)"
  echo "✓ drizzle-studio is active. Listener: ${PORT:-(checking...)}"
  echo ""
  echo "Open in your browser:  https://local.drizzle.studio"
  echo "Live logs:             journalctl --user -u drizzle-studio -f"
  echo "Stop when done:        systemctl --user stop drizzle-studio && bash packages/db/systemd/clear-env.sh"
else
  echo "✗ drizzle-studio failed to start. Check: journalctl --user -u drizzle-studio -n 30" >&2
  exit 3
fi
