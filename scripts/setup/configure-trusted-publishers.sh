#!/usr/bin/env bash
# Configure npm OIDC trusted publishing for all RevealUI packages.
# Requires: npm >= 11.10.0 (uses npx npm@latest if local version is older)
#
# Usage: bash scripts/setup/configure-trusted-publishers.sh
#
# On the first run, npm will prompt for 2FA. When the npmjs.com 2FA page
# appears, check "skip 2FA for the next 5 minutes" so the remaining
# packages proceed without re-prompting.

set -euo pipefail

PACKAGES=(
  "@revealui/animations"
  "@revealui/auth"
  "@revealui/cache"
  "@revealui/cli"
  "@revealui/config"
  "@revealui/contracts"
  "@revealui/core"
  "@revealui/db"
  "@revealui/editors"
  "@revealui/mcp"
  "@revealui/openapi"
  "@revealui/presentation"
  "@revealui/resilience"
  "@revealui/router"
  "@revealui/security"
  "@revealui/services"
  "@revealui/setup"
  "@revealui/sync"
  "@revealui/utils"
  "create-revealui"
)

REPO="RevealUIStudio/revealui"
WORKFLOW="release.yml"
ENVIRONMENT="npm-publish"

# Use npx npm@latest if local npm is too old
NPM_CMD=(npm)
NPM_VERSION=$("${NPM_CMD[@]}" --version 2>/dev/null | cut -d. -f1,2)
REQUIRED="11.10"
if [[ "$(printf '%s\n' "$REQUIRED" "$NPM_VERSION" | sort -V | head -n1)" != "$REQUIRED" ]]; then
  echo "Local npm $NPM_VERSION < $REQUIRED — using npx npm@latest"
  NPM_CMD=(npx npm@latest)
fi

echo "Configuring trusted publishing for ${#PACKAGES[@]} packages..."
echo "  Repo:        $REPO"
echo "  Workflow:    $WORKFLOW"
echo "  Environment: $ENVIRONMENT"
echo ""

SUCCESS=0
FAILED=0

for pkg in "${PACKAGES[@]}"; do
  echo "→ $pkg"
  if "${NPM_CMD[@]}" trust github "$pkg" \
    --repo "$REPO" \
    --file "$WORKFLOW" \
    --env "$ENVIRONMENT" \
    --yes 2>&1; then
    SUCCESS=$((SUCCESS + 1))
  else
    echo "  ✗ FAILED"
    FAILED=$((FAILED + 1))
  fi
  sleep 2  # avoid rate limiting
done

echo ""
echo "Done: $SUCCESS configured, $FAILED failed (out of ${#PACKAGES[@]} packages)"

# Verify
echo ""
echo "Verifying..."
for pkg in "${PACKAGES[@]}"; do
  echo "=== $pkg ==="
  "${NPM_CMD[@]}" trust list "$pkg" 2>&1 || echo "  (no trusted publishers)"
done
