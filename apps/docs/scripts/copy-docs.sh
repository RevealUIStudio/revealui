#!/bin/bash
# Copy documentation from main docs/ directory to apps/docs/public/
# This ensures apps/docs serves the canonical documentation.
#
# CHIP-3 D5a: target is `public/` (not `public/docs/`) so served URLs
# match suite-root file layout — docs.revealui.com/admin-guide resolves
# to public/ADMIN_GUIDE.md.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
SOURCE_DOCS="$REPO_ROOT/docs"
TARGET_DOCS="$REPO_ROOT/apps/docs/public"

echo "Copying documentation from source to docs app..."
echo "   Source: $SOURCE_DOCS"
echo "   Target: $TARGET_DOCS"

# The public/internal boundary is enforced fail-closed below, after the copy, by
# scripts/prune-non-public.mjs (single source of truth: scripts/served-docs.mjs).

# Clean previously-copied docs.
# CHIP-3: target is `public/` (shared with non-docs static assets like
# sitemap.xml, robots.txt, vite build artifacts), so we cannot blanket
# `rm -rf` it. Remove only the .md files and any docs subdirs that
# came from the source.
echo "   Cleaning previously copied docs..."
if [ -d "$TARGET_DOCS" ]; then
  # Remove top-level .md files (these all came from suite-root docs/)
  find "$TARGET_DOCS" -maxdepth 1 -type f -name "*.md" -delete
  # Remove docs-source subdirectories (anything that exists at the source).
  # We list source subdirs and delete the matching dest subdirs.
  while IFS= read -r SRC_SUBDIR; do
    SUBDIR_NAME="$(basename "$SRC_SUBDIR")"
    DEST_SUBDIR="$TARGET_DOCS/$SUBDIR_NAME"
    if [ -d "$DEST_SUBDIR" ]; then
      rm -rf "$DEST_SUBDIR"
    fi
  done < <(find "$SOURCE_DOCS" -mindepth 1 -maxdepth 1 -type d ! -name "archive")
fi

# Ensure target exists.
mkdir -p "$TARGET_DOCS"

# Copy contents of docs/ into public/ (note the trailing dot — this copies
# CONTENTS rather than the docs/ directory itself, avoiding extra nesting).
echo "   Copying files..."
cp -r "$SOURCE_DOCS"/. "$TARGET_DOCS"/

# Remove the archive subdirectory (large, not for public consumption)
if [ -d "$TARGET_DOCS/archive" ]; then
  rm -rf "$TARGET_DOCS/archive"
fi

# Enforce the fail-closed public/internal boundary: remove every doc COPIED from
# docs/ that is not `visibility: public`. Scoped to copied docs, so hand-tracked
# public-only content (public/docs-pro/, assets) is left alone.
# Single source of truth: scripts/served-docs.mjs.
echo "   Enforcing visibility boundary (fail-closed: visibility: public only)..."
node "$SCRIPT_DIR/prune-non-public.mjs" "$TARGET_DOCS" "$SOURCE_DOCS"

# Count files copied (only .md files at any depth, excluding archive)
FILE_COUNT=$(find "$TARGET_DOCS" -type f -name "*.md" | wc -l)

echo "Documentation copied successfully!"
echo "   Files copied: $FILE_COUNT markdown files (public)"
echo ""
echo "Note: docs in apps/docs/public/ are build artifacts."
echo "   Edit files in /docs/ (repo root), not in apps/docs/public/"
