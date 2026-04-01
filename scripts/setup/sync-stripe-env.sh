#!/usr/bin/env bash
# sync-stripe-env.sh — Push Stripe price IDs to RevVault + Vercel
#
# Reads .revealui/stripe-env.json (written by pnpm stripe:seed), merges the
# price IDs into the RevVault stripe vault, and pushes any missing vars to
# Vercel production.
#
# Usage:
#   pnpm stripe:sync-env                # RevVault + Vercel
#   pnpm stripe:sync-env --vault-only   # RevVault only (no Vercel push)
#   pnpm stripe:sync-env --vercel-only  # Vercel only (no RevVault update)
#   pnpm stripe:sync-env --dry-run      # Preview what would be synced
#
# Prerequisites:
#   - .revealui/stripe-env.json exists (run pnpm stripe:seed first)
#   - revvault binary at ~/.local/bin/revvault
#   - vercel CLI authenticated (for Vercel sync)
#   - jq installed

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
CACHE_FILE="$ROOT_DIR/.revealui/stripe-env.json"
REVVAULT="$HOME/.local/bin/revvault"
VAULT_PATH="revealui/env/stripe"

DRY_RUN=false
SKIP_VAULT=false
SKIP_VERCEL=false

for arg in "$@"; do
  case "$arg" in
    --dry-run)      DRY_RUN=true ;;
    --vault-only)   SKIP_VERCEL=true ;;
    --vercel-only)  SKIP_VAULT=true ;;
  esac
done

# ── Preflight ────────────────────────────────────────────────────────────────

if [[ ! -f "$CACHE_FILE" ]]; then
  echo "ERROR: $CACHE_FILE not found. Run 'pnpm stripe:seed' first." >&2
  exit 1
fi

if ! command -v jq &>/dev/null; then
  echo "ERROR: jq is required. Install with: nix profile install nixpkgs#jq" >&2
  exit 1
fi

# ── Read price IDs from cache ────────────────────────────────────────────────

# Extract all env var entries as KEY=VALUE lines
PRICE_VARS=$(jq -r '.envVars | to_entries[] | "\(.key)=\(.value)"' "$CACHE_FILE")
PRICE_COUNT=$(echo "$PRICE_VARS" | wc -l)

echo "Found $PRICE_COUNT price ID vars in $CACHE_FILE"
echo ""

# ── Sync to RevVault ─────────────────────────────────────────────────────────

if [[ "$SKIP_VAULT" == false ]]; then
  if [[ ! -x "$REVVAULT" ]]; then
    echo "WARN: revvault not found at $REVVAULT — skipping vault sync" >&2
  else
    echo "=== RevVault sync ($VAULT_PATH) ==="

    # Read current vault contents
    CURRENT_VAULT=$("$REVVAULT" export-env "$VAULT_PATH" 2>/dev/null || true)

    # Build merged vault content: existing vars + new/updated price vars
    # Start with existing non-price vars (preserve STRIPE_SECRET_KEY, etc.)
    MERGED=""
    while IFS= read -r line; do
      # export KEY='VALUE' → KEY=VALUE
      key=$(echo "$line" | sed "s/^export //; s/=.*//")
      # Skip if this key is in the new price vars (will be replaced)
      if ! echo "$PRICE_VARS" | grep -q "^${key}="; then
        # Strip export prefix and quotes for storage
        clean=$(echo "$line" | sed "s/^export //; s/='\(.*\)'$/=\1/")
        MERGED="${MERGED}${clean}"$'\n'
      fi
    done <<< "$CURRENT_VAULT"

    # Append all price vars
    MERGED="${MERGED}${PRICE_VARS}"

    if [[ "$DRY_RUN" == true ]]; then
      echo "[DRY RUN] Would write to vault $VAULT_PATH:"
      echo "$MERGED" | while IFS= read -r line; do
        key="${line%%=*}"
        echo "  $key=<redacted>"
      done
    else
      echo "$MERGED" | "$REVVAULT" set --force "$VAULT_PATH"
      echo "Wrote $(echo "$MERGED" | wc -l) vars to $VAULT_PATH"

      # Verify
      VERIFY_COUNT=$("$REVVAULT" export-env "$VAULT_PATH" 2>/dev/null | grep -c 'PRICE' || true)
      echo "Verified: $VERIFY_COUNT PRICE vars now in vault"
    fi
    echo ""
  fi
fi

# ── Sync to Vercel ───────────────────────────────────────────────────────────

if [[ "$SKIP_VERCEL" == false ]]; then
  if ! command -v vercel &>/dev/null; then
    echo "WARN: vercel CLI not found — skipping Vercel sync" >&2
  else
    echo "=== Vercel sync (production) ==="

    # Get current Vercel env vars
    VERCEL_VARS=$(vercel env ls production 2>&1 || true)

    ADDED=0
    SKIPPED=0

    while IFS='=' read -r key value; do
      [[ -z "$key" ]] && continue

      if echo "$VERCEL_VARS" | grep -q "$key"; then
        SKIPPED=$((SKIPPED + 1))
      else
        if [[ "$DRY_RUN" == true ]]; then
          echo "  [DRY RUN] Would add: $key"
        else
          vercel env add "$key" production --yes --value "$value" </dev/null 2>&1 | tail -1
          echo "  Added: $key"
        fi
        ADDED=$((ADDED + 1))
      fi
    done <<< "$PRICE_VARS"

    echo ""
    echo "Vercel: $ADDED added, $SKIPPED already present"
  fi
fi

# ── Summary ──────────────────────────────────────────────────────────────────

echo ""
if [[ "$DRY_RUN" == true ]]; then
  echo "DRY RUN complete. Re-run without --dry-run to apply."
else
  echo "Sync complete. Run 'direnv reload' to pick up vault changes locally."
fi
