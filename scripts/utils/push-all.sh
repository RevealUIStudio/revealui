#!/usr/bin/env bash
# Push to origin, then background a --no-verify push to LTS backup.
# Usage: git pushall [args...]   (via git alias)
#   or:  scripts/utils/push-all.sh [args...]

set -euo pipefail

ARGS="${@:-}"

echo "→ Pushing to origin..."
git push origin $ARGS

if git remote get-url lts &>/dev/null; then
  echo "→ Backgrounding LTS backup push..."
  git push --no-verify lts $ARGS &
  echo "  LTS push running in background (PID $!)"
else
  echo "⚠ No lts remote configured — skipping backup push"
fi
