#!/bin/bash

# Cursor Environment Fix Script
# Forces pnpm to use the correct Node version for Cursor sandbox

set -e

echo "🔧 Cursor Environment Fix"
echo "=========================="

# Ensure we're using Node 24.12.0
export PATH="/home/joshua-v-dev/.nvm/versions/node/v24.12.0/bin:$PATH"

# Verify Node version
echo "Node version: $(node --version)"
echo "pnpm version: $(pnpm --version)"

# Remove pnpm's cached Node version info
echo "Cleaning pnpm cache..."
rm -rf ~/.local/share/pnpm/store ~/.cache/pnpm

# Reinstall pnpm if needed
if ! command -v pnpm &> /dev/null; then
    echo "Reinstalling pnpm..."
    npm install -g pnpm
fi

echo "✅ Environment fixed!"
echo ""
echo "Test commands:"
echo "  pnpm typecheck:all"
echo "  pnpm test"
echo ""
echo "If still failing, try:"
echo "  nvm exec 24.12.0 pnpm typecheck:all"