#!/usr/bin/env bash
# Maintained coordinated push. Validate before opening the remote transport;
# the pre-push hook verifies and consumes the exact-HEAD receipt.
# Usage: pnpm push [target-branch [remote]]
# Dirty work is rejected, never copied, reverted, deleted, or overwritten.
set -euo pipefail

if ! command -v flock >/dev/null 2>&1; then
  echo "ERROR: coordinated push requires flock for ownership-safe locking." >&2
  exit 1
fi

# Do not unlink this file: a new inode would allow concurrent holders.
LOCK_FILE="${TMPDIR:-/tmp}/revealui-push-$(id -u).lock"
umask 077
exec 9>>"$LOCK_FILE"
echo "Waiting for coordinated push admission..."
if ! flock --exclusive --wait 300 9; then
  echo "ERROR: another coordinated push still owns admission." >&2
  exit 1
fi

BRANCH=$(git symbolic-ref --quiet --short HEAD)
TARGET="${1:-$BRANCH}"
REMOTE="${2:-origin}"
if [ "$#" -gt 2 ] || ! git check-ref-format "refs/heads/$TARGET"; then
  echo "ERROR: expected pnpm push [target-branch [remote]]." >&2
  exit 1
fi
if ! git remote get-url -- "$REMOTE" >/dev/null; then
  echo "ERROR: push remote is not configured." >&2
  exit 1
fi
SOURCE_STATUS=$(git status --porcelain --untracked-files=all)
if [ -n "$SOURCE_STATUS" ]; then
  echo "ERROR: coordinated push requires a clean index and worktree; all uncommitted work is preserved." >&2
  exit 1
fi

ROOT=$(git rev-parse --show-toplevel)
GIT_DIR=$(git rev-parse --git-dir)
if [ ! -e "$ROOT/node_modules" ]; then
  echo "ERROR: node_modules missing — cannot run the required push gate." >&2
  exit 1
fi

# Git opens its SSH/HTTPS transport before invoking pre-push. Run the long
# quality gate first so an idle remote connection cannot expire while it runs.
VALIDATED_SHA=$(git rev-parse HEAD)
case "$TARGET" in
  main|test)
    pnpm gate --no-build --no-test
    ;;
  *)
    pnpm gate --phase=1 --changed
    ;;
esac

AFTER_SHA=$(git rev-parse HEAD)
AFTER_STATUS=$(git status --porcelain --untracked-files=all)
if [ "$VALIDATED_SHA" != "$AFTER_SHA" ] || [ -n "$AFTER_STATUS" ]; then
  echo "ERROR: source changed during validation; push rejected and work preserved." >&2
  exit 1
fi

RECEIPT="$GIT_DIR/prepush-validated-receipt"
RECEIPT_TEMP="$RECEIPT.$$"
trap 'rm -f "$RECEIPT" "$RECEIPT_TEMP"' EXIT
printf '%s\n%s\n' "$VALIDATED_SHA" "refs/heads/$TARGET" > "$RECEIPT_TEMP"
mv "$RECEIPT_TEMP" "$RECEIPT"

# Push the exact checkout that passed the gate. The hook checks the receipt,
# rechecks clean HEAD/worktree state and retains admission locking.
git push -- "$REMOTE" "HEAD:refs/heads/$TARGET"
