#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# WSL disk cleanup — removes temp files, caches, and orphans
#
# Usage:  pnpm cleanup          (standard cleanup)
#         pnpm cleanup --deep   (aggressive — also clears turbo remote cache)
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

# ── /tmp cleanup ─────────────────────────────────────────────
echo "[1/5] Cleaning /tmp..."

for pattern in "revealui-push-stash-*" "revealui-gate-worktree-*" "agent-stash*" "mcp-stores-stash"; do
  for d in /tmp/$pattern; do
    [ -d "$d" ] || continue
    count_size "$d"
    rm -rf "$d"
    echo "  Removed $d"
  done
done

# Stale lock files
rm -f /tmp/revealui-push.lock 2>/dev/null && echo "  Removed stale push lock" || true

# Session IDs older than 12 hours
STALE_SESSIONS=$(find /tmp -maxdepth 1 -name "revealui-session-*.id" -mmin +720 2>/dev/null | wc -l)
find /tmp -maxdepth 1 -name "revealui-session-*.id" -mmin +720 -delete 2>/dev/null || true
[ "$STALE_SESSIONS" -gt 0 ] && echo "  Removed $STALE_SESSIONS stale session ID file(s)"

# Claude autocommit/agent-edit temp files
for pattern in "claude-autocommit-*" "claude-agent-edits-*" "claude-session-*"; do
  STALE=$(find /tmp -maxdepth 1 -name "$pattern" -mmin +720 2>/dev/null | wc -l)
  find /tmp -maxdepth 1 -name "$pattern" -mmin +720 -delete 2>/dev/null || true
  [ "$STALE" -gt 0 ] && echo "  Removed $STALE stale $pattern file(s)"
done

# ── Git worktree cleanup ─────────────────────────────────────
echo "[2/5] Pruning git worktrees..."
git worktree prune 2>/dev/null && echo "  Done" || echo "  Skipped"

# ── Turbo cache ──────────────────────────────────────────────
echo "[3/5] Clearing turbo cache..."
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
    echo "  Removed $TURBO_CACHE (remote cache)"
  fi
fi

# ── Next.js caches ───────────────────────────────────────────
echo "[4/5] Clearing Next.js build caches..."
for app in apps/cms apps/marketing; do
  for cache in "$app/.next/cache" "$app/.next/trace"; do
    if [ -d "$cache" ]; then
      count_size "$cache"
      rm -rf "$cache"
      echo "  Removed $cache"
    fi
  done
done

# ── Disk report ──────────────────────────────────────────────
echo "[5/5] Disk status..."
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
