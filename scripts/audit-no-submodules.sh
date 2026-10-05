#!/usr/bin/env bash
# =============================================================================
# No-Submodules Audit
#
# Verifies zero git submodules exist in this repository.
# RevealUI policy: cross-repo deps publish to npm / workspace, never .gitmodules.
#
# Checks:
#   1. No .gitmodules file at repo root
#   2. No modules storage in the resolved Git/common directories
#   3. No submodule entries in git config
#   4. No tree-object gitlinks (mode 160000) in HEAD
#
# Exit codes:
#   0 — all checks pass (no submodules found)
#   1 — one or more checks failed (submodules detected)
#   2 — repository context or inspection failed
#
# Usage:
#   bash scripts/audit-no-submodules.sh
# =============================================================================

set -euo pipefail

# Command substitution strips all trailing newlines. Preserve the path bytes
# behind a sentinel, then remove only Git's single output delimiter.
capture_git_path() {
  local captured
  if ! captured=$(git rev-parse "$@" && printf '.'); then
    return 1
  fi
  captured=${captured%.}
  if [[ "$captured" != *$'\n' ]]; then return 1; fi
  AUDIT_GIT_PATH=${captured%$'\n'}
  [ -n "$AUDIT_GIT_PATH" ]
}

if ! capture_git_path --show-toplevel; then
  echo "ERROR: Cannot inspect a Git worktree." >&2
  exit 2
fi
REPO_ROOT="$AUDIT_GIT_PATH"
if ! cd "$REPO_ROOT"; then
  echo "ERROR: Cannot read the repository root." >&2
  exit 2
fi
if ! HEAD_TREE=$(git rev-parse --verify 'HEAD^{tree}'); then
  echo "ERROR: Cannot inspect the HEAD tree." >&2
  exit 2
fi
if ! capture_git_path --absolute-git-dir; then
  echo "ERROR: Cannot resolve the Git directory." >&2
  exit 2
fi
GIT_DIRECTORY="$AUDIT_GIT_PATH"
if ! capture_git_path --path-format=absolute --git-common-dir; then
  echo "ERROR: Cannot resolve the common Git directory." >&2
  exit 2
fi
GIT_COMMON_DIRECTORY="$AUDIT_GIT_PATH"

PASS=0
FAIL=0

pass() {
  echo "  ✓ $1"
  PASS=$((PASS + 1))
}

fail() {
  echo "  ✗ $1"
  FAIL=$((FAIL + 1))
}

echo "========================================"
echo "  No-Submodules Audit"
echo "========================================"
echo ""

# Check 1: .gitmodules file
if [ -e .gitmodules ] || [ -L .gitmodules ]; then
  fail ".gitmodules artifact exists at repo root"
else
  pass "No .gitmodules file"
fi

# Check 2: Git resolves storage for normal and linked worktrees.
MODULE_ARTIFACTS=0
inspect_modules() {
  local directory="$1"
  local modules="$directory/modules"
  local entries
  if [ ! -r "$directory" ] || [ ! -x "$directory" ]; then
    echo "ERROR: Cannot inspect Git storage: $directory" >&2
    exit 2
  fi
  if [ -L "$modules" ]; then
    MODULE_ARTIFACTS=1
  elif [ -e "$modules" ]; then
    if [ -d "$modules" ]; then
      if [ ! -r "$modules" ] || [ ! -x "$modules" ]; then
        echo "ERROR: Cannot inspect submodule storage: $modules" >&2
        exit 2
      fi
      # Escape control characters so command substitution cannot erase a
      # newline-only artifact name and turn a nonempty listing into absence.
      if ! entries=$(ls -A -q -- "$modules"); then
        echo "ERROR: Cannot list submodule storage: $modules" >&2
        exit 2
      fi
      if [ -n "$entries" ]; then MODULE_ARTIFACTS=1; fi
    else
      MODULE_ARTIFACTS=1
    fi
  fi
}
inspect_modules "$GIT_DIRECTORY"
if [ "$GIT_COMMON_DIRECTORY" != "$GIT_DIRECTORY" ]; then
  inspect_modules "$GIT_COMMON_DIRECTORY"
fi
if [ "$MODULE_ARTIFACTS" -eq 1 ]; then
  fail "Git modules storage contains stale submodule data"
else
  pass "No Git modules storage artifacts"
fi

# Check 3: capture complete structured names before interpreting any records.
if ! INSPECTION_DIR=$(mktemp -d); then
  echo "ERROR: Cannot create private inspection storage." >&2
  exit 2
fi
trap 'rm -rf -- "$INSPECTION_DIR"' EXIT
if ! git config --null --name-only --list > "$INSPECTION_DIR/config"; then
  echo "ERROR: Cannot inspect Git configuration." >&2
  exit 2
fi
CONFIG_SUBMODULE=0
while IFS= read -r -d '' CONFIG_NAME; do
  case "$CONFIG_NAME" in
    submodule.*) CONFIG_SUBMODULE=1 ;;
  esac
done < "$INSPECTION_DIR/config"
if [ "$CONFIG_SUBMODULE" -eq 1 ]; then
  fail "git config contains submodule entries"
else
  pass "No submodule entries in git config"
fi

# Check 4: tree-object gitlinks (mode 160000)
if ! git ls-tree -r --format='%(objectmode)' "$HEAD_TREE" > "$INSPECTION_DIR/modes"; then
  echo "ERROR: Cannot inspect Git tree modes." >&2
  exit 2
fi
TREE_SUBMODULE=0
while IFS= read -r TREE_MODE; do
  if [ "$TREE_MODE" = "160000" ]; then
    TREE_SUBMODULE=1
  fi
done < "$INSPECTION_DIR/modes"
if [ "$TREE_SUBMODULE" -eq 1 ]; then
  fail "Tree contains gitlinks (mode 160000) — submodule references in HEAD"
else
  pass "No gitlinks in HEAD tree"
fi

echo ""
echo "----------------------------------------"
echo "  Results: $PASS passed, $FAIL failed"
echo "----------------------------------------"

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "FAIL: Submodule artifacts detected."
  echo "See docs/submodules/POLICY.md for remediation."
  exit 1
fi

echo ""
echo "PASS: No submodules found."
exit 0
