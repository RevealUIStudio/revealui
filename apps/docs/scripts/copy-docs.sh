#!/bin/bash
# Legacy entrypoint name kept so external callers do not break.
# The docs publish plane no longer materializes monorepo docs/ into
# apps/docs/public/*.md.
#
# SoT: monorepo docs/
# Dev:  Vite docs-publish middleware serves visibility:public markdown
# Build: docs-publish plugin emits into apps/docs/dist/ only
# Hand-authored exception: apps/docs/public/docs-pro/ (tracked)
#
# This script only cleans leftover generated markdown from public/
# (migration hygiene). Prefer: pnpm --filter docs dev|build

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "[docs-publish] clean leftover generated markdown under apps/docs/public/"
node "$SCRIPT_DIR/clean-public-mirror.mjs"
echo "   Edit monorepo docs/ only. See public/DOCS-PUBLISH-PLANE.txt"
