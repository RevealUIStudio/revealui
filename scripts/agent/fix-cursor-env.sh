#!/bin/bash
# =============================================================================
# Cursor Environment Fix Script
# =============================================================================
# Forces pnpm to use the correct Node version for Cursor sandbox
#
# Usage:
#   ./scripts/agent/fix-cursor-env.sh [options]
#
# Options:
#   --json       Output in JSON format (for automation)
#   --no-color   Disable colored output
#   --verbose    Show detailed output
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/_helpers.sh"

# Node version to use
NODE_VERSION="${NODE_VERSION:-24.12.0}"

show_help() {
  if [ "$JSON_MODE" = "true" ]; then
    json_success '{"command": "help", "message": "Use --help without --json for usage information"}'
    exit $EXIT_SUCCESS
  fi

  cat << 'EOF'
Cursor Environment Fix Script

Forces pnpm to use the correct Node version for Cursor sandbox.

Usage: ./scripts/agent/fix-cursor-env.sh [options]

Options:
  --json       Output in JSON format (for automation)
  --no-color   Disable colored output
  --verbose    Show detailed output

Environment Variables:
  NODE_VERSION - Node version to use (default: 24.12.0)

Example:
  ./scripts/agent/fix-cursor-env.sh
  NODE_VERSION=22.0.0 ./scripts/agent/fix-cursor-env.sh --json
EOF
}

fix_cursor_env() {
  local node_path="/home/$USER/.nvm/versions/node/v${NODE_VERSION}/bin"
  local original_node_version=""
  local original_pnpm_version=""
  local final_node_version=""
  local final_pnpm_version=""
  local cache_cleaned=false
  local pnpm_reinstalled=false

  # Store original versions
  original_node_version=$(node --version 2>/dev/null || echo "not found")
  original_pnpm_version=$(pnpm --version 2>/dev/null || echo "not found")

  log_info "Cursor Environment Fix"
  log_debug "Target Node version: $NODE_VERSION"
  log_debug "Current Node version: $original_node_version"
  log_debug "Current pnpm version: $original_pnpm_version"

  # Ensure we're using the correct Node version
  if [ -d "$node_path" ]; then
    export PATH="$node_path:$PATH"
    log_success "Updated PATH to use Node v$NODE_VERSION"
  else
    if [ "$JSON_MODE" = "true" ]; then
      json_error "NOT_FOUND" "Node v$NODE_VERSION not found at $node_path"
    else
      log_error "Node v$NODE_VERSION not found at $node_path"
      log_info "Install it with: nvm install $NODE_VERSION"
    fi
    exit $EXIT_NOT_FOUND
  fi

  # Verify Node version
  final_node_version=$(node --version 2>/dev/null || echo "not found")
  log_debug "Node version after PATH update: $final_node_version"

  # Remove pnpm's cached Node version info
  log_info "Cleaning pnpm cache..."
  rm -rf ~/.local/share/pnpm/store ~/.cache/pnpm 2>/dev/null || true
  cache_cleaned=true
  log_success "Cleaned pnpm cache"

  # Reinstall pnpm if needed
  if ! command -v pnpm &> /dev/null; then
    log_info "Reinstalling pnpm..."
    npm install -g pnpm
    pnpm_reinstalled=true
    log_success "Reinstalled pnpm"
  fi

  # Get final versions
  final_pnpm_version=$(pnpm --version 2>/dev/null || echo "not found")

  if [ "$JSON_MODE" = "true" ]; then
    json_success "{
      \"nodeVersion\": \"$final_node_version\",
      \"pnpmVersion\": \"$final_pnpm_version\",
      \"originalNodeVersion\": \"$original_node_version\",
      \"originalPnpmVersion\": \"$original_pnpm_version\",
      \"cacheCleared\": $cache_cleaned,
      \"pnpmReinstalled\": $pnpm_reinstalled,
      \"nodePath\": \"$node_path\"
    }"
  else
    log_success "Environment fixed!"
    echo ""
    echo "Node version: $final_node_version"
    echo "pnpm version: $final_pnpm_version"
    echo ""
    log_header "Test Commands"
    echo "  pnpm typecheck:all"
    echo "  pnpm test"
    echo ""
    log_info "If still failing, try:"
    echo "  nvm exec $NODE_VERSION pnpm typecheck:all"
  fi
}

# =============================================================================
# Main
# =============================================================================

# Parse common flags
parse_common_flags "$@"
set -- "${REMAINING_ARGS[@]}"

# Handle help
if [ "${1:-}" = "help" ] || [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  show_help
  exit $EXIT_SUCCESS
fi

# Run fix
fix_cursor_env
