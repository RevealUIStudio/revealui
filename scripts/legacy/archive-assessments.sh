#!/bin/bash
# Archive Assessment Files
# Moves all assessment/execution files to docs/archive/assessments

set -e

echo "=========================================="
echo "Archiving Assessment Files"
echo "=========================================="

ARCHIVE_DIR="docs/archive/assessments"
mkdir -p "$ARCHIVE_DIR"

# Find all assessment files
FILES=$(find . -name "*ASSESSMENT*.md" -o -name "*BRUTAL*.md" -o -name "*EXECUTION*.md" -o -name "*VALIDATION*.md" 2>/dev/null | grep -v node_modules | grep -v "$ARCHIVE_DIR" | sort)

# Keep the consolidated assessment
KEEP_FILES=(
  "ASSESSMENT-CONSOLIDATED.md"
  "BRUTAL-ASSESSMENT-ULTIMATE-FINAL.md"
  "IMPLEMENTATION-COMPLETE.md"
  "EXECUTION-COMPLETE-SUMMARY.md"
  "MANUAL-VALIDATION-GUIDE.md"
  "AUTOMATED-VALIDATION-GUIDE.md"
  "AUTOMATION-QUICK-START.md"
  "DOCKER-WSL2-SETUP.md"
)

COUNT=0
for file in $FILES; do
  # Skip if file is in KEEP_FILES
  filename=$(basename "$file")
  skip=false
  for keep in "${KEEP_FILES[@]}"; do
    if [ "$filename" = "$keep" ]; then
      skip=true
      break
    fi
  done
  
  if [ "$skip" = false ]; then
    # Move to archive
    mv "$file" "$ARCHIVE_DIR/" 2>/dev/null || true
    COUNT=$((COUNT + 1))
    echo "Archived: $filename"
  else
    echo "Kept: $filename"
  fi
done

echo ""
echo "=========================================="
echo "✅ Archived $COUNT files"
echo "=========================================="
echo "Archive location: $ARCHIVE_DIR"
echo ""
echo "Kept files (active):"
for keep in "${KEEP_FILES[@]}"; do
  if [ -f "$keep" ]; then
    echo "  - $keep"
  fi
done
echo ""
