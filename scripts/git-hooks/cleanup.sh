#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Checkout cache cleanup — preserves saved work and admission leases
#
# Usage:  pnpm cleanup          (standard cleanup)
#         pnpm cleanup --deep   (also clears the user Turbo cache)
# ─────────────────────────────────────────────────────────────
set -euo pipefail

DEEP=0
[[ "${1:-}" == "--deep" ]] && DEEP=1

freed=0
count_size() {
  local size
  size=$(du -s "$1" 2>/dev/null | awk '{print $1}')
  freed=$((freed + ${size:-0}))
}

echo ""
echo "═══════════════════════════════════════════════════"
echo "  RevealUI Disk Cleanup"
echo "═══════════════════════════════════════════════════"
echo ""

# Temporary snapshots, session IDs, and lock files have independent owners.
# Names and ages do not prove that saved work is disposable or a lease dead.
# Cleanup never reclaims those files or another checkout's worktree metadata.
echo "[1/3] Clearing checkout Turbo caches..."

# ── Turbo cache ──────────────────────────────────────────────

for d in .turbo node_modules/.cache/turbo; do
  if [ -d "$d" ]; then
    count_size "$d"
    rm -rf "$d"
    echo "  Removed $d"
  fi
done

if [ "$DEEP" -eq 1 ]; then
  TURBO_CACHE="$HOME/.turbo"
  if [ -d "$TURBO_CACHE" ]; then
    count_size "$TURBO_CACHE"
    rm -rf "$TURBO_CACHE"
    echo "  Removed $TURBO_CACHE (user cache)"
  fi
fi

# ── Next.js caches ───────────────────────────────────────────
echo "[2/3] Clearing Next.js build caches..."
for app in apps/admin apps/marketing; do
  for cache in "$app/.next/cache" "$app/.next/trace"; do
    if [ -d "$cache" ]; then
      count_size "$cache"
      rm -rf "$cache"
      echo "  Removed $cache"
    fi
  done
done

# ── Disk report ──────────────────────────────────────────────
echo "[3/3] Disk status..."
AVAIL=$(df --output=avail -h / 2>/dev/null | tail -1 | tr -d ' ')
USED=$(df --output=pcent / 2>/dev/null | tail -1 | tr -d ' ')
FREED_MB=$((freed / 1024))

echo "  Available: $AVAIL"
echo "  Used: $USED"
[ "$FREED_MB" -gt 0 ] && echo "  Freed: ~${FREED_MB}MB"

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Cleanup complete"
echo "═══════════════════════════════════════════════════"
