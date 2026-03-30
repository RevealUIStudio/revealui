#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Coordinated push — prevents concurrent agent push conflicts
#
# Usage:  pnpm push            (pushes current branch to origin)
#         pnpm push main       (pushes to specific branch)
#
# Strategy: run the gate in a temporary git worktree so other
# agents' in-progress files never interfere. The main worktree
# is untouched — no stash, no restore, no lost files.
#
# What it does:
#   1. Acquires an exclusive lock (only one push at a time)
#   2. Creates a clean worktree from HEAD
#   3. Runs `pnpm gate` in the worktree (isolated from agents)
#   4. If gate passes, pushes from the main worktree
#   5. Removes the worktree and releases the lock
# ─────────────────────────────────────────────────────────────
set -euo pipefail

LOCK_FILE="/tmp/revealui-push.lock"
LOCK_TIMEOUT=600  # 10 minutes max hold
WORKTREE_DIR=""

# ── Cleanup on exit (always runs) ────────────────────────────
cleanup() {
  local exit_code=$?

  # Remove worktree
  if [ -n "$WORKTREE_DIR" ] && [ -d "$WORKTREE_DIR" ]; then
    git worktree remove --force "$WORKTREE_DIR" 2>/dev/null || rm -rf "$WORKTREE_DIR"
  fi

  # Release lock
  if [ -f "$LOCK_FILE" ]; then
    local lock_pid
    lock_pid=$(cat "$LOCK_FILE" 2>/dev/null || echo "")
    if [ "$lock_pid" = "$$" ]; then
      rm -f "$LOCK_FILE"
    fi
  fi

  exit $exit_code
}
trap cleanup EXIT

# ── Acquire lock ─────────────────────────────────────────────
acquire_lock() {
  local attempts=0
  local max_attempts=60  # 60 * 5s = 5 minutes wait

  while [ $attempts -lt $max_attempts ]; do
    # Atomic create — fails if file exists
    if (set -C; echo $$ > "$LOCK_FILE") 2>/dev/null; then
      return 0
    fi

    # Check if holder is still alive
    local holder_pid
    holder_pid=$(cat "$LOCK_FILE" 2>/dev/null || echo "")
    if [ -n "$holder_pid" ] && ! kill -0 "$holder_pid" 2>/dev/null; then
      echo "  Stale lock from dead process $holder_pid — removing"
      rm -f "$LOCK_FILE"
      continue
    fi

    # Check lock age (prevent indefinite holds)
    if [ -f "$LOCK_FILE" ]; then
      local lock_age
      lock_age=$(( $(date +%s) - $(stat -c %Y "$LOCK_FILE" 2>/dev/null || echo "$(date +%s)") ))
      if [ "$lock_age" -gt "$LOCK_TIMEOUT" ]; then
        echo "  Lock held for ${lock_age}s (timeout: ${LOCK_TIMEOUT}s) — forcing release"
        rm -f "$LOCK_FILE"
        continue
      fi
    fi

    attempts=$((attempts + 1))
    if [ $((attempts % 6)) -eq 1 ]; then
      echo "  Waiting for push lock (held by PID $holder_pid, attempt $attempts)..."
    fi
    sleep 5
  done

  echo "ERROR: Could not acquire push lock after $((max_attempts * 5))s"
  exit 1
}

# ── Main ─────────────────────────────────────────────────────
BRANCH=$(git rev-parse --abbrev-ref HEAD)
TARGET="${1:-$BRANCH}"
REMOTE="${2:-origin}"

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Coordinated Push: $REMOTE/$TARGET"
echo "═══════════════════════════════════════════════════"
echo ""

# Step 1: Acquire exclusive lock
echo "[1/5] Acquiring push lock..."
acquire_lock
echo "  Lock acquired (PID $$)"

# Step 2: Create isolated worktree
WORKTREE_DIR="/tmp/revealui-gate-worktree-$$"
echo "[2/5] Creating clean worktree at $WORKTREE_DIR..."
git worktree add --detach "$WORKTREE_DIR" HEAD -q
echo "  Done"

# Step 3: Install deps in worktree (shares node_modules via hoisting)
echo "[3/5] Installing dependencies in worktree..."
(cd "$WORKTREE_DIR" && pnpm install --frozen-lockfile --prefer-offline -s 2>/dev/null) || true
echo "  Done"

# Step 4: Run gate in worktree (isolated — other agents can't interfere)
echo "[4/5] Running gate in isolated worktree..."
echo ""
GATE_EXIT=0
(cd "$WORKTREE_DIR" && pnpm gate) || GATE_EXIT=$?

if [ "$GATE_EXIT" -ne 0 ]; then
  echo ""
  echo "═══════════════════════════════════════════════════"
  echo "  Gate FAILED — push aborted"
  echo "═══════════════════════════════════════════════════"
  exit "$GATE_EXIT"
fi

# Step 5: Gate passed — push (skip pre-push hook since we already ran gate)
echo ""
echo "[5/5] Gate passed — pushing to $REMOTE/$TARGET..."
export REVEALUI_PUSH_COORDINATED=1
git push --no-verify "$REMOTE" "$TARGET"

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Push succeeded"
echo "═══════════════════════════════════════════════════"
