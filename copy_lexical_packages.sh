#!/bin/bash

# Script to copy all missing lexical packages
# Usage: ./copy_lexical_packages.sh

set -e  # Exit on any error

SOURCE_DIR="/tmp/lexical-source/packages"
DEST_DIR="/home/joshua-v-dev/projects/RevealUI/packages/revealui/src/lexical/packages"

echo "📦 Copying missing lexical packages..."

# List of packages to copy (excluding dev/demo packages)
PACKAGES_TO_COPY=(
    "lexical-clipboard"
    "lexical-code"
    "lexical-code-shiki"
    "lexical-devtools"
    "lexical-devtools-core"
    "lexical-dragon"
    "lexical-eslint-plugin"
    "lexical-eslint-plugin-internal"
    "lexical-extension"
    "lexical-file"
    "lexical-hashtag"
    "lexical-history"
    "lexical-offset"
    "lexical-overflow"
    "lexical-plain-text"
    "lexical-table"
    "lexical-tailwind"
    "lexical-text"
    "lexical-yjs"
)

# Copy each package
for package in "${PACKAGES_TO_COPY[@]}"; do
    if [ -d "$SOURCE_DIR/$package" ]; then
        echo "Copying $package..."
        cp -r "$SOURCE_DIR/$package" "$DEST_DIR/"
        echo "✅ $package copied successfully"
    else
        echo "❌ $package not found in source directory"
    fi
done

echo "🎉 All lexical packages copied!"
echo "Verifying copy..."

# Verify all packages were copied
copied_count=$(ls -1d "$DEST_DIR"/lexical-* 2>/dev/null | wc -l)
expected_count=$((11 + ${#PACKAGES_TO_COPY[@]}))  # 11 we had + 19 new ones

echo "Expected packages: $expected_count"
echo "Actually copied: $copied_count"

if [ "$copied_count" -eq "$expected_count" ]; then
    echo "✅ All packages copied successfully!"
else
    echo "❌ Package count mismatch. Expected $expected_count, got $copied_count"
    exit 1
fi

echo "📋 Final package list:"
ls -1 "$DEST_DIR" | grep "^lexical-"
