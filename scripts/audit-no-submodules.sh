#!/usr/bin/env bash
# =============================================================================
# No-Submodules Audit
#
# Verifies zero git submodules exist in this repository.
# RevealUI policy: cross-repo deps publish to npm / workspace, never .gitmodules.
#
# Checks:
#   1. No .gitmodules file at repo root
#   2. No .git/modules/ directory (stale submodule artifacts)
#   3. No submodule entries in git config
#   4. No tree-object gitlinks (mode 160000) in HEAD
#
# Exit codes:
#   0 — all checks pass (no submodules found)
#   1 — one or more checks failed (submodules detected)
#
# Usage:
#   bash scripts/audit-no-submodules.sh
# =============================================================================

set -euo pipefail

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
if [ -f .gitmodules ]; then
  fail ".gitmodules file exists at repo root"
else
  pass "No .gitmodules file"
fi

# Check 2: .git/modules/ directory
if [ -d .git/modules ] && [ "$(ls -A .git/modules/ 2>/dev/null)" ]; then
  fail ".git/modules/ directory contains stale submodule data"
else
  pass "No .git/modules/ artifacts"
fi

# Check 3: git config submodule entries
if git config --list 2>/dev/null | grep -q "^submodule\."; then
  fail "git config contains submodule entries"
else
  pass "No submodule entries in git config"
fi

# Check 4: tree-object gitlinks (mode 160000)
if git ls-tree -r HEAD 2>/dev/null | grep -q "^160000 "; then
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
