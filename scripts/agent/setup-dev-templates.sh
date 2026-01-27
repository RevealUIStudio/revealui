#!/bin/bash

# Simple setup script for development templates

echo "🎯 RevealUI Development Templates Setup"
echo "======================================"

# Check if running on macOS or Linux
if [[ "$OSTYPE" == "darwin"* ]]; then
    VSCODE_DIR="$HOME/Library/Application Support/Code/User/snippets"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    VSCODE_DIR="$HOME/.config/Code/User/snippets"
else
    echo "❌ Unsupported OS. Please manually copy snippets to your VS Code snippets directory."
    exit 1
fi

# Create snippets directory if it doesn't exist
mkdir -p "$VSCODE_DIR"

# Copy the snippets file
cp ".cursor/snippets/development.code-snippets" "$VSCODE_DIR/"

echo "✅ Snippets installed to: $VSCODE_DIR"
echo ""
echo "🚀 Usage:"
echo "1. Restart VS Code/Cursor"
echo "2. In any file, type 'devtask' and press Tab"
echo "3. Fill in the template sections"
echo ""
echo "Available snippets:"
echo "- devtask: General development tasks"
echo "- testtask: Testing tasks"
echo "- bugfix: Bug fixes"