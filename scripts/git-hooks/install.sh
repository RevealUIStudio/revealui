#!/usr/bin/env bash
#
# Install Git Hooks
#
# Sets up pre-commit hook for code validation
#

set -e

REPO_ROOT=$(git rev-parse --show-toplevel)
HOOKS_DIR="$REPO_ROOT/.git/hooks"
HOOK_SCRIPT="$REPO_ROOT/scripts/git-hooks/pre-commit"

echo "🔧 Installing Git hooks..."

# Ensure hooks directory exists
mkdir -p "$HOOKS_DIR"

# Create symlink to pre-commit hook
if [ -L "$HOOKS_DIR/pre-commit" ]; then
  echo "  ℹ️  Pre-commit hook already installed (symlink exists)"
elif [ -f "$HOOKS_DIR/pre-commit" ]; then
  echo "  ⚠️  Pre-commit hook file exists, backing up..."
  mv "$HOOKS_DIR/pre-commit" "$HOOKS_DIR/pre-commit.backup"
  ln -sf "$HOOK_SCRIPT" "$HOOKS_DIR/pre-commit"
  echo "  ✓ Pre-commit hook installed (old hook backed up)"
else
  ln -sf "$HOOK_SCRIPT" "$HOOKS_DIR/pre-commit"
  echo "  ✓ Pre-commit hook installed"
fi

# Make hook executable
chmod +x "$HOOK_SCRIPT"
chmod +x "$HOOKS_DIR/pre-commit"

echo ""
echo "✅ Git hooks installed successfully!"
echo ""
echo "The pre-commit hook will now validate code before each commit."
echo "To bypass validation (emergencies only):"
echo "  git commit --no-verify"
echo ""
