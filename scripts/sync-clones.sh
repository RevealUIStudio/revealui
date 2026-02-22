#!/usr/bin/env bash
set -euo pipefail

# sync-clones.sh — Push to all remotes and sync read-only clones
#
# Usage:
#   ./scripts/sync-clones.sh          # Push to GitHub + LTS, pull Windows clone
#   ./scripts/sync-clones.sh --github # Push to GitHub only
#   ./scripts/sync-clones.sh --lts    # Push to LTS only
#   ./scripts/sync-clones.sh --win    # Pull Windows clone only

REPO_DIR="${HOME}/projects/RevealUI"
WIN_CLONE="/mnt/c/Users/joshu/projects/RevealUI"
BRANCH="${1:-main}"

cd "$REPO_DIR"

# Parse flags
DO_GITHUB=true
DO_LTS=true
DO_WIN=true

if [[ "${1:-}" == "--github" ]]; then
  DO_LTS=false; DO_WIN=false; shift
elif [[ "${1:-}" == "--lts" ]]; then
  DO_GITHUB=false; DO_WIN=false; shift
elif [[ "${1:-}" == "--win" ]]; then
  DO_GITHUB=false; DO_LTS=false; shift
fi

BRANCH="${1:-main}"

echo "=== RevealUI Clone Sync ==="
echo "Branch: $BRANCH"
echo ""

# Push to GitHub (source of truth)
if $DO_GITHUB; then
  echo "-> Pushing to GitHub (origin)..."
  if git push origin "$BRANCH" 2>&1; then
    echo "   GitHub: OK"
  else
    echo "   GitHub: FAILED (pre-push gate may have blocked)"
    exit 1
  fi
fi

# Push to LTS backup drive
if $DO_LTS; then
  echo "-> Pushing to LTS drive (lts)..."
  if git remote get-url lts &>/dev/null; then
    if git push lts "$BRANCH" 2>&1; then
      echo "   LTS: OK"
    else
      echo "   LTS: FAILED (drive may not be mounted)"
    fi
  else
    echo "   LTS: SKIPPED (no 'lts' remote configured)"
  fi
fi

# Pull into Windows reference clone
if $DO_WIN; then
  echo "-> Syncing Windows reference clone..."
  if [[ -d "$WIN_CLONE/.git" ]]; then
    if git -C "$WIN_CLONE" pull origin "$BRANCH" 2>&1; then
      echo "   Windows: OK"
    else
      echo "   Windows: FAILED"
    fi
  else
    echo "   Windows: SKIPPED (clone not found at $WIN_CLONE)"
  fi
fi

echo ""
echo "=== Sync complete ==="
