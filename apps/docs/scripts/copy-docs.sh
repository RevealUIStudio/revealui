#!/bin/bash
# Copy documentation from main docs/ directory to apps/docs/public/docs/
# This ensures apps/docs serves the canonical documentation

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
SOURCE_DOCS="$REPO_ROOT/docs"
TARGET_DOCS="$REPO_ROOT/apps/docs/public/docs"

echo "Copying documentation from source to docs app..."
echo "   Source: $SOURCE_DOCS"
echo "   Target: $TARGET_DOCS"

# Create target directory if it doesn't exist
mkdir -p "$TARGET_DOCS"

# Remove existing docs to ensure clean copy
if [ -d "$TARGET_DOCS" ]; then
  echo "   Cleaning existing docs..."
  rm -rf "$TARGET_DOCS"
fi

# Internal-only files that must never be served publicly
INTERNAL_FILES=(
  "AUTOMATION.md"
  "STANDARDS.md"
)

# Copy all documentation (flat structure — no subdirectories)
echo "   Copying files..."
cp -r "$SOURCE_DOCS" "$TARGET_DOCS"

# Remove internal-only files from the public directory
echo "   Removing internal docs..."
for FILE in "${INTERNAL_FILES[@]}"; do
  INTERNAL_PATH="$TARGET_DOCS/$FILE"
  if [ -f "$INTERNAL_PATH" ]; then
    rm "$INTERNAL_PATH"
    echo "   Excluded: $FILE"
  fi
done

# Count files copied
FILE_COUNT=$(find "$TARGET_DOCS" -type f -name "*.md" | wc -l)

echo "Documentation copied successfully!"
echo "   Files copied: $FILE_COUNT markdown files (public)"
echo ""
echo "Note: docs/public/docs/ is a build artifact."
echo "   Edit files in /docs/ (repo root), not in apps/docs/public/docs/"
