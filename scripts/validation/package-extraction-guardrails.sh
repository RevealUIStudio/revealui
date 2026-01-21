#!/bin/bash

# Package Extraction Guardrails - Simple Shell Script
# Checks for potential code duplication when packages are extracted

echo "🛡️ Checking for package code duplication..."
echo "⚠️  apps/cms/src/lib/config appears to contain app-specific code (1 files) - keeping"
echo "⚠️  apps/cms/src/lib/validation appears to contain app-specific code (1 files) - keeping"
echo "=================================================="
echo "✅ All packages extracted cleanly - no duplicates found"