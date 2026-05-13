#!/usr/bin/env bash
# Install the drizzle-studio systemd-user service.
#
# Idempotent: re-running copies the latest unit file + reloads the
# daemon but does NOT clobber an existing env file. Mirrors the
# revdev daemon's install pattern at packages/daemon/systemd/.
#
# After install:
#   - Populate ~/.config/drizzle-studio/env with POSTGRES_URL
#     (or use the start-prod.sh wrapper for the revvault-fetched prod URL)
#   - systemctl --user start drizzle-studio
#   - journalctl  --user -u drizzle-studio -f   (live logs)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UNIT_FILE="drizzle-studio.service"
UNIT_DIR="$HOME/.config/systemd/user"
ENV_DIR="$HOME/.config/drizzle-studio"
ENV_FILE="$ENV_DIR/env"

# 1. Copy unit file into user systemd path.
mkdir -p "$UNIT_DIR"
cp "$SCRIPT_DIR/$UNIT_FILE" "$UNIT_DIR/$UNIT_FILE"
echo "✓ Installed $UNIT_DIR/$UNIT_FILE"

# 2. Seed env file template if not present. Mode 0600 — file holds DB credentials.
mkdir -p "$ENV_DIR"
chmod 0700 "$ENV_DIR"
if [ ! -f "$ENV_FILE" ]; then
  cat > "$ENV_FILE" <<'EOF'
# drizzle-studio service environment file.
#
# Populate POSTGRES_URL (or DATABASE_URL) with the target DB
# connection string before starting the service. The file is mode 0600
# and gitignored — credentials never reach a remote.
#
# For prod recovery: use the start-prod.sh wrapper, which fetches the
# URL from revvault, writes it here, and starts the service in one step.
#
# After editing this file, restart the service:
#   systemctl --user restart drizzle-studio
POSTGRES_URL=
EOF
  chmod 0600 "$ENV_FILE"
  echo "✓ Seeded $ENV_FILE (mode 0600). Populate POSTGRES_URL before starting."
else
  echo "↳ $ENV_FILE already exists; not clobbering."
fi

# 3. systemd daemon-reload so the new unit is visible.
systemctl --user daemon-reload
echo "✓ systemd --user daemon-reload"

cat <<EOF

drizzle-studio unit installed.

Next steps:
  1. Populate POSTGRES_URL in $ENV_FILE — OR — use:
       bash packages/db/systemd/start-prod.sh    # prod (from revvault)
  2. Start:   systemctl --user start drizzle-studio
  3. Verify:  systemctl --user status drizzle-studio
              ss -tlnp | grep 4983
  4. Open:    https://local.drizzle.studio  in your browser
  5. Stop:    systemctl --user stop drizzle-studio
              (env file persists — clear POSTGRES_URL by hand for prod sessions)

Live logs: journalctl --user -u drizzle-studio -f
EOF
