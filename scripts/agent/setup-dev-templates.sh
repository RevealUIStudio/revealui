#!/bin/bash
# =============================================================================
# Development Templates Setup Script
# =============================================================================
# Simple setup script for development templates (VS Code/Cursor snippets)
#
# Usage:
#   ./scripts/agent/setup-dev-templates.sh [options]
#
# Options:
#   --json       Output in JSON format (for automation)
#   --no-color   Disable colored output
#   --verbose    Show detailed output
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/_helpers.sh"

show_help() {
  if [ "$JSON_MODE" = "true" ]; then
    json_success '{"command": "help", "message": "Use --help without --json for usage information"}'
    exit $EXIT_SUCCESS
  fi

  cat << 'EOF'
Development Templates Setup Script

Simple setup script for development templates (VS Code/Cursor snippets)

Usage: ./scripts/agent/setup-dev-templates.sh [options]

Options:
  --json       Output in JSON format (for automation)
  --no-color   Disable colored output
  --verbose    Show detailed output

Available snippets:
  - devtask: General development tasks
  - testtask: Testing tasks
  - bugfix: Bug fixes
EOF
}

setup_templates() {
  local vscode_dir=""
  local os_type=""
  local source_file=".cursor/snippets/development.code-snippets"

  # Check if running on macOS or Linux
  if [[ "$OSTYPE" == "darwin"* ]]; then
    vscode_dir="$HOME/Library/Application Support/Code/User/snippets"
    os_type="macos"
  elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    vscode_dir="$HOME/.config/Code/User/snippets"
    os_type="linux"
  else
    if [ "$JSON_MODE" = "true" ]; then
      json_error "VALIDATION_ERROR" "Unsupported OS: $OSTYPE"
    else
      log_error "Unsupported OS. Please manually copy snippets to your VS Code snippets directory."
    fi
    exit $EXIT_VALIDATION_ERROR
  fi

  log_info "RevealUI Development Templates Setup"
  log_debug "OS type: $os_type"
  log_debug "VS Code snippets directory: $vscode_dir"

  # Check source file exists
  if [ ! -f "$source_file" ]; then
    if [ "$JSON_MODE" = "true" ]; then
      json_error "NOT_FOUND" "Source file not found: $source_file"
    else
      log_error "Source file not found: $source_file"
    fi
    exit $EXIT_NOT_FOUND
  fi

  # Create snippets directory if it doesn't exist
  mkdir -p "$vscode_dir"
  log_debug "Created snippets directory (if needed)"

  # Copy the snippets file
  if cp "$source_file" "$vscode_dir/"; then
    log_success "Snippets installed to: $vscode_dir"
  else
    if [ "$JSON_MODE" = "true" ]; then
      json_error "EXECUTION_ERROR" "Failed to copy snippets file"
    else
      log_error "Failed to copy snippets file"
    fi
    exit $EXIT_EXECUTION_ERROR
  fi

  if [ "$JSON_MODE" = "true" ]; then
    json_success "{
      \"installed\": true,
      \"destination\": \"$vscode_dir\",
      \"source\": \"$source_file\",
      \"osType\": \"$os_type\",
      \"snippets\": [\"devtask\", \"testtask\", \"bugfix\"]
    }"
  else
    echo ""
    log_header "Usage"
    echo "1. Restart VS Code/Cursor"
    echo "2. In any file, type 'devtask' and press Tab"
    echo "3. Fill in the template sections"
    echo ""
    echo "Available snippets:"
    echo "- devtask: General development tasks"
    echo "- testtask: Testing tasks"
    echo "- bugfix: Bug fixes"
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

# Run setup
setup_templates
