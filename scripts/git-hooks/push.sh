#!/usr/bin/env bash
# Maintained coordinated push. The pre-push hook remains the validation owner.
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

# Push the checkout validated by the hook, rather than a same-named local ref.
git push -- "$REMOTE" "HEAD:refs/heads/$TARGET"
