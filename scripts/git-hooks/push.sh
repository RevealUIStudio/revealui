#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Coordinated push — prevents concurrent agent push conflicts
#
# Usage:  pnpm push            (pushes current branch to origin)
#         pnpm push main       (pushes to specific branch)
#
# Strategy: file-copy stash (not git stash — never loses data)
#
#   1. Cleans up orphaned temp files from prior runs
#   2. Checks disk space (aborts if < 1GB free)
#   3. Acquires an exclusive lock (one push at a time)
#   4. Copies dirty files to /tmp, cleans the worktree
#   5. Clears turbo cache
#   6. Runs git push (pre-push hook runs the gate on clean tree)
#   7. Restores files from /tmp and releases the lock
#
# The pre-push hook detects REVEALUI_PUSH_COORDINATED=1 and
# skips its own stash/restore (this script handles it).
# ─────────────────────────────────────────────────────────────
set -euo pipefail

LOCK_FILE="/tmp/revealui-push.lock"
LOCK_TIMEOUT=600        # 10 minutes max hold
STASH_DIR=""
FILE_COUNT=0
MIN_DISK_MB=1024        # 1GB minimum free space

# ── Cleanup orphaned temp files from prior runs ──────────────
cleanup_orphans() {
  # Remove stale push stashes (older than 2 hours)
  find /tmp -maxdepth 1 -name "revealui-push-stash-*" -type d -mmin +120 -exec rm -rf {} + 2>/dev/null || true

  # Remove stale worktrees (from abandoned worktree approach)
  find /tmp -maxdepth 1 -name "revealui-gate-worktree-*" -type d -mmin +60 -exec rm -rf {} + 2>/dev/null || true
  git worktree prune 2>/dev/null || true

  # Remove stale lock files (holder dead or timed out)
  if [ -f "$LOCK_FILE" ]; then
    local holder_pid
    holder_pid=$(cat "$LOCK_FILE" 2>/dev/null || echo "")
    if [ -n "$holder_pid" ] && ! kill -0 "$holder_pid" 2>/dev/null; then
      rm -f "$LOCK_FILE"
    fi
  fi

  # Remove old agent-stash dirs
  find /tmp -maxdepth 1 -name "agent-stash*" -type d -mmin +120 -exec rm -rf {} + 2>/dev/null || true

  # Remove stale session ID files (older than 12 hours)
  find /tmp -maxdepth 1 -name "revealui-session-*.id" -mmin +720 -delete 2>/dev/null || true
}

# ── Check disk space ─────────────────────────────────────────
check_disk() {
  local avail_kb
  avail_kb=$(df --output=avail / 2>/dev/null | tail -1 | tr -d ' ')
  local avail_mb=$((avail_kb / 1024))

  if [ "$avail_mb" -lt "$MIN_DISK_MB" ]; then
    echo "ERROR: Only ${avail_mb}MB free (need ${MIN_DISK_MB}MB minimum)"
    echo "  Run: pnpm cleanup   — to free temp files and caches"
    exit 1
  fi

  if [ "$avail_mb" -lt 5120 ]; then
    echo "  Warning: ${avail_mb}MB free — consider running 'pnpm cleanup'"
  fi
}

# ── Restore on exit (always runs) ────────────────────────────
restore_and_unlock() {
  local exit_code=$?

  # Restore saved files (plain copy — never conflicts)
  if [ -n "$STASH_DIR" ] && [ -f "$STASH_DIR/manifest" ]; then
    echo ""
    echo "Restoring $FILE_COUNT file(s) from other agents..."
    while IFS= read -r relpath; do
      local dir
      dir=$(dirname "$relpath")
      mkdir -p "$dir"
      cp -f "$STASH_DIR/files/$relpath" "$relpath"
    done < "$STASH_DIR/manifest"
    echo "  Done"
    rm -rf "$STASH_DIR"
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
trap restore_and_unlock EXIT

# ── Acquire lock ─────────────────────────────────────────────
acquire_lock() {
  local attempts=0
  local max_attempts=60  # 60 * 5s = 5 minutes wait

  while [ $attempts -lt $max_attempts ]; do
    if (set -C; echo $$ > "$LOCK_FILE") 2>/dev/null; then
      return 0
    fi

    local holder_pid
    holder_pid=$(cat "$LOCK_FILE" 2>/dev/null || echo "")
    if [ -n "$holder_pid" ] && ! kill -0 "$holder_pid" 2>/dev/null; then
      echo "  Stale lock (PID $holder_pid dead) — removing"
      rm -f "$LOCK_FILE"
      continue
    fi

    if [ -f "$LOCK_FILE" ]; then
      local lock_age
      lock_age=$(( $(date +%s) - $(stat -c %Y "$LOCK_FILE" 2>/dev/null || echo "$(date +%s)") ))
      if [ "$lock_age" -gt "$LOCK_TIMEOUT" ]; then
        echo "  Lock expired (${lock_age}s) — forcing release"
        rm -f "$LOCK_FILE"
        continue
      fi
    fi

    attempts=$((attempts + 1))
    if [ $((attempts % 6)) -eq 1 ]; then
      echo "  Waiting for push lock (PID $holder_pid, attempt $attempts)..."
    fi
    sleep 5
  done

  echo "ERROR: Could not acquire push lock after $((max_attempts * 5))s"
  exit 1
}

# ── Save dirty files to /tmp, clean worktree ─────────────────
save_and_clean() {
  # -u lists individual files (not directory summaries)
  local status_file
  status_file=$(mktemp)
  git status --porcelain -u > "$status_file" 2>/dev/null || true

  if [ ! -s "$status_file" ]; then
    rm -f "$status_file"
    return 0
  fi

  STASH_DIR=$(mktemp -d /tmp/revealui-push-stash-XXXXXXXXXX)
  chmod 700 "$STASH_DIR"
  mkdir -p "$STASH_DIR/files"
  : > "$STASH_DIR/manifest"

  while IFS= read -r line; do
    local status="${line:0:2}"
    local filepath="${line:3}"

    # Skip deleted
    [[ "$status" == " D" || "$status" == "D " ]] && continue

    # Handle renames
    [[ "$filepath" == *" -> "* ]] && filepath="${filepath##* -> }"

    # Strip quotes
    filepath="${filepath%\"}"
    filepath="${filepath#\"}"

    if [ -f "$filepath" ]; then
      local dir
      dir=$(dirname "$filepath")
      mkdir -p "$STASH_DIR/files/$dir"
      cp -f "$filepath" "$STASH_DIR/files/$filepath"
      echo "$filepath" >> "$STASH_DIR/manifest"
      FILE_COUNT=$((FILE_COUNT + 1))
    fi
  done < "$status_file"
  rm -f "$status_file"

  if [ "$FILE_COUNT" -eq 0 ]; then
    rm -rf "$STASH_DIR"
    STASH_DIR=""
    return 0
  fi

  echo "  Saved $FILE_COUNT file(s) to $STASH_DIR"

  # Clean: revert tracked files
  git checkout -- . 2>/dev/null || true

  # Clean: remove untracked files we saved
  while IFS= read -r relpath; do
    if ! git ls-files --error-unmatch "$relpath" >/dev/null 2>&1; then
      rm -f "$relpath" 2>/dev/null || true
      # Remove empty parent dirs
      local parent
      parent=$(dirname "$relpath")
      while [ "$parent" != "." ] && [ -d "$parent" ] && [ -z "$(ls -A "$parent" 2>/dev/null)" ]; do
        rmdir "$parent" 2>/dev/null || break
        parent=$(dirname "$parent")
      done
    fi
  done < "$STASH_DIR/manifest"

  local remaining
  remaining=$(git status --porcelain -u 2>/dev/null | wc -l)
  if [ "$remaining" -gt 0 ]; then
    echo "  Warning: $remaining file(s) still dirty after cleanup"
  fi
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

# Step 0: Housekeeping
echo "[0/5] Cleaning up orphaned temp files..."
cleanup_orphans
check_disk
echo "  Done"

# Step 1: Lock
echo "[1/5] Acquiring push lock..."
acquire_lock
echo "  Lock acquired (PID $$)"

# Step 2: Save dirty files
echo "[2/5] Saving uncommitted files to /tmp..."
save_and_clean

# Step 3: Clear turbo cache
echo "[3/5] Clearing turbo cache..."
rm -rf .turbo node_modules/.cache/turbo 2>/dev/null || true
echo "  Done"

# Step 4: Push (pre-push hook runs gate on clean tree)
echo "[4/5] Pushing to $REMOTE/$TARGET..."
echo ""
export REVEALUI_PUSH_COORDINATED=1
git push "$REMOTE" "$TARGET"

echo ""
echo "[5/5] Push succeeded — files will be restored on exit"
echo ""
echo "═══════════════════════════════════════════════════"
echo "  Push succeeded"
echo "═══════════════════════════════════════════════════"
