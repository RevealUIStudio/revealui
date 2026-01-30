#!/bin/bash
# Docker entrypoint for OpenCode server

set -e

# Add opencode to PATH if not already there
export PATH="$HOME/.local/bin:$PATH"

# Check if opencode is installed
if ! command -v opencode &> /dev/null; then
    echo "❌ OpenCode not found. Installing..."
    curl -fsSL https://opencode.ai/install | bash
fi

# Handle different modes
if [ "$1" = "server" ] || [ "$1" = "api" ]; then
    # If you want to run OpenCode as an API server (requires custom setup)
    echo "🚀 Starting OpenCode server mode..."
    echo "Note: OpenCode is primarily a CLI tool. For API mode, you'd need to wrap it."
    exec opencode "$@"
elif [ "$1" = "shell" ] || [ "$1" = "bash" ]; then
    # Interactive shell mode
    echo "🐚 Starting interactive shell..."
    exec /bin/bash
elif [ "$1" = "version" ]; then
    # Show version
    opencode --version
else
    # Default: run opencode with provided arguments
    echo "🤖 Running OpenCode..."
    exec opencode "$@"
fi