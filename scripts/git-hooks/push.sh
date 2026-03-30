#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# Coordinated push — prevents concurrent agent push conflicts
#
# Usage:  pnpm push            (pushes current branch to origin)
#         pnpm push main       (pushes to specific branch)
#
# What it does:
#   1. Acquires an exclusive lock (only one push at a time)
#   2. Clears turbo cache (prevents stale test/build results)
#   3. Copies dirty files to /tmp, then cleans the worktree
#   4. Runs git push (pre-push hook runs the gate on clean tree)
#   5. Copies files back from /tmp and releases the lock
#
# Why not git stash?
#   git stash pop conflicts when the index changed during the
#   gate, or when other agents wrote new files in the interim.
#   Plain file copies never conflict — they just overwrite.
#
# The pre-push hook detects REVEALUI_PUSH_COORDINATED=1 and
# skips its own stash/restore cycle (this script handles it).
# ─────────────────────────────────────────────────────────────
set -euo pipefail

LOCK_FILE="/tmp/revealui-push.lock"
LOCK_TIMEOUT=600  # 10 minutes max hold
STASH_DIR=""
FILE_COUNT=0

# ── Cleanup on exit (always runs) ────────────────────────────
cleanup() {
  local exit_code=$?

  # Restore saved files
  if [ -n "$STASH_DIR" ] && [ -d "$STASH_DIR/files" ]; then
    echo ""
    echo "Restoring $FILE_COUNT file(s) from other agents..."

    # Restore each file to its original path
    while IFS= read -r relpath; do
      local dir
      dir=$(dirname "$relpath")
      mkdir -p "$dir"
      cp -f "$STASH_DIR/files/$relpath" "$relpath"
    done < "$STASH_DIR/manifest"

    echo "  Done — all files restored"
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

# ── Save dirty files to /tmp, then clean worktree ────────────
save_dirty_files() {
  # Collect dirty file list into a temp file (avoids subshell pipe)
  local status_file
  status_file=$(mktemp)
  git status --porcelain > "$status_file" 2>/dev/null || true

  if [ ! -s "$status_file" ]; then
    rm -f "$status_file"
    return 0
  fi

  STASH_DIR="/tmp/revealui-push-stash-$$"
  mkdir -p "$STASH_DIR/files"
  : > "$STASH_DIR/manifest"

  # Read from file, not pipe — no subshell variable scoping issues
  while IFS= read -r line; do
    local status="${line:0:2}"
    local filepath="${line:3}"

    # Skip deleted files
    [[ "$status" == " D" || "$status" == "D " ]] && continue

    # Handle renames (take new path)
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

  # Clean the worktree: revert tracked, remove untracked
  git checkout -- . 2>/dev/null || true

  # Remove untracked files that we saved
  while IFS= read -r relpath; do
    if ! git ls-files --error-unmatch "$relpath" >/dev/null 2>&1; then
      rm -f "$relpath" 2>/dev/null || true
      # Clean up empty parent dirs
      local parent
      parent=$(dirname "$relpath")
      while [ "$parent" != "." ] && [ -d "$parent" ] && [ -z "$(ls -A "$parent" 2>/dev/null)" ]; do
        rmdir "$parent" 2>/dev/null || break
        parent=$(dirname "$parent")
      done
    fi
  done < "$STASH_DIR/manifest"

  # Verify clean
  local remaining
  remaining=$(git status --porcelain 2>/dev/null | wc -l)
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

# Step 1: Acquire exclusive lock
echo "[1/4] Acquiring push lock..."
acquire_lock
echo "  Lock acquired (PID $$)"

# Step 2: Clear turbo cache
echo "[2/4] Clearing turbo cache..."
rm -rf .turbo node_modules/.cache/turbo 2>/dev/null || true
echo "  Done"

# Step 3: Save dirty files to /tmp (no git stash — just file copies)
echo "[3/4] Checking for uncommitted files..."
save_dirty_files

# Step 4: Push (pre-push hook will run the gate)
echo "[4/4] Pushing to $REMOTE/$TARGET..."
echo ""
export REVEALUI_PUSH_COORDINATED=1
git push "$REMOTE" "$TARGET"

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Push succeeded"
echo "═══════════════════════════════════════════════════"
