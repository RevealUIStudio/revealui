#!/bin/bash

# Check for console statements in production code
# These should be removed or replaced with proper logging

echo "Checking for console statements in production code..."
echo ""

CONSOLE_COUNT=0
FILES_WITH_CONSOLE=()

# Search for console statements (excluding test files and node_modules)
while IFS= read -r file; do
    # Count console statements
    COUNT=$(grep -c "console\." "$file" 2>/dev/null || echo "0")
    if [ "$COUNT" -gt 0 ]; then
        CONSOLE_COUNT=$((CONSOLE_COUNT + COUNT))
        FILES_WITH_CONSOLE+=("$file")
    fi
done < <(find apps/cms/src apps/web/src packages/reveal/src -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) ! -path "*/node_modules/*" ! -path "*/__tests__/*" ! -path "*/dist/*" ! -path "*/.next/*" 2>/dev/null)

if [ $CONSOLE_COUNT -eq 0 ]; then
    echo "✅ No console statements found in production code"
    exit 0
else
    echo "⚠️  Found $CONSOLE_COUNT console statement(s) in production code:"
    echo ""
    for file in "${FILES_WITH_CONSOLE[@]}"; do
        echo "  - $file"
        grep -n "console\." "$file" 2>/dev/null | head -3 | sed 's/^/    /'
    done
    echo ""
    echo "Recommendation: Remove or replace with proper logging service"
    exit 1
fi

