#!/bin/bash
# =============================================================================
# Antigravity WSL Fix Script
# =============================================================================
# Fixes Antigravity configuration for WSL environment
#
# Usage:
#   ./scripts/agent/fix_antigravity.sh [options]
#
# Options:
#   --json       Output in JSON format (for automation)
#   --no-color   Disable colored output
#   --verbose    Show detailed output
#   --force      Skip confirmation prompts
#
# Environment Variables:
#   WIN_USER - Windows username (auto-detected if not set)
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/_helpers.sh"

# Configuration
VSIX_URL="https://marketplace.visualstudio.com/_apis/public/gallery/publishers/ms-vscode-remote/vsextensions/remote-wsl/0.81.8/vspackage"

show_help() {
  if [ "$JSON_MODE" = "true" ]; then
    json_success '{"command": "help", "message": "Use --help without --json for usage information"}'
    exit $EXIT_SUCCESS
  fi

  cat << 'EOF'
Antigravity WSL Fix Script

Fixes Antigravity configuration for WSL environment.

Usage: ./scripts/agent/fix_antigravity.sh [options]

Options:
  --json       Output in JSON format (for automation)
  --no-color   Disable colored output
  --verbose    Show detailed output
  --force      Skip confirmation prompts

Environment Variables:
  WIN_USER - Windows username (auto-detected if not set)

Example:
  ./scripts/agent/fix_antigravity.sh
  WIN_USER=myuser ./scripts/agent/fix_antigravity.sh --json
EOF
}

fix_antigravity() {
  local win_user=""
  local temp_dir=""
  local antigravity_base=""
  local ext_scripts_dir=""
  local launcher_file=""

  log_info "Starting Antigravity WSL Fix..."

  # Auto-detect Windows username
  if [ -n "${WIN_USER:-}" ]; then
    win_user="$WIN_USER"
  elif [ -n "${LOGNAME:-}" ]; then
    win_user="$LOGNAME"
  elif command -v cmd.exe &> /dev/null; then
    win_user=$(cmd.exe /c "echo %USERNAME%" 2>/dev/null | tr -d '\r\n')
  else
    # Fallback: try to detect from /mnt/c/Users
    win_user=$(ls /mnt/c/Users 2>/dev/null | grep -v -E '^(Public|Default|All Users|Default User)$' | head -1)
  fi

  if [ -z "$win_user" ]; then
    if [ "$JSON_MODE" = "true" ]; then
      json_error "CONFIG_ERROR" "Could not auto-detect Windows username. Set WIN_USER environment variable."
    else
      log_error "Could not auto-detect Windows username."
      log_info "Please set WIN_USER environment variable manually:"
      echo "  WIN_USER=yourusername ./scripts/agent/fix_antigravity.sh"
    fi
    exit $EXIT_CONFIG_ERROR
  fi

  log_success "Detected Windows user: $win_user"

  # Configuration paths
  antigravity_base="/mnt/c/Users/${win_user}/AppData/Local/Programs/Antigravity"
  ext_scripts_dir="${antigravity_base}/resources/app/extensions/antigravity-remote-wsl/scripts"
  launcher_file="${antigravity_base}/bin/antigravity"
  temp_dir=$(mktemp -d)

  # Cleanup function
  cleanup() {
    rm -rf "${temp_dir}"
  }
  trap cleanup EXIT

  log_debug "Working directory: ${temp_dir}"

  # Verify Antigravity installation exists
  if [ ! -d "$antigravity_base" ]; then
    if [ "$JSON_MODE" = "true" ]; then
      json_error "NOT_FOUND" "Antigravity installation not found at $antigravity_base"
    else
      log_error "Antigravity installation not found at $antigravity_base"
      log_info "Make sure Antigravity is installed for user: $win_user"
    fi
    exit $EXIT_NOT_FOUND
  fi

  # 1. Download and Extract VSIX
  log_info "Downloading Remote-WSL extension..."
  if ! curl -L --compressed -k -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36" -o "${temp_dir}/remote-wsl.zip" "${VSIX_URL}"; then
    if [ "$JSON_MODE" = "true" ]; then
      json_error "NETWORK_ERROR" "Failed to download extension"
    else
      log_error "Failed to download extension."
    fi
    exit $EXIT_NETWORK_ERROR
  fi

  log_debug "Verifying download..."
  file "${temp_dir}/remote-wsl.zip" >/dev/null

  log_info "Extracting extension..."
  if ! unzip -q "${temp_dir}/remote-wsl.zip" -d "${temp_dir}/ext" 2>/dev/null; then
    log_debug "Attempting fallback for double-compressed files..."
    mv "${temp_dir}/remote-wsl.zip" "${temp_dir}/remote-wsl.gz"
    gunzip "${temp_dir}/remote-wsl.gz"
    mv "${temp_dir}/remote-wsl" "${temp_dir}/remote-wsl.zip"

    if ! unzip -q "${temp_dir}/remote-wsl.zip" -d "${temp_dir}/ext" 2>/dev/null; then
      if [ "$JSON_MODE" = "true" ]; then
        json_error "EXECUTION_ERROR" "Failed to unzip extension"
      else
        log_error "Failed to unzip extension. Please verify internet connectivity."
      fi
      exit $EXIT_EXECUTION_ERROR
    fi
  fi

  # 2. Deploy Scripts
  log_info "Deploying scripts to: ${ext_scripts_dir}"
  mkdir -p "${ext_scripts_dir}"
  cp "${temp_dir}/ext/extension/scripts/"* "${ext_scripts_dir}/" 2>/dev/null || true
  log_success "Scripts deployed"

  # 3. Patch Launcher
  log_info "Patching launcher: ${launcher_file}"
  if [ -f "${launcher_file}" ]; then
    # Create backup with timestamp
    local backup_file="${launcher_file}.bak.$(date +%s)"
    cp "${launcher_file}" "$backup_file"
    log_debug "Backup created: $backup_file"

    # Replace ID using perl for cross-platform compatibility
    perl -pi -e 's/WSL_EXT_ID="ms-vscode-remote.remote-wsl"/WSL_EXT_ID="google.antigravity-remote-wsl"/g' "${launcher_file}"
    log_success "Launcher patched"
  else
    if [ "$JSON_MODE" = "true" ]; then
      json_error "NOT_FOUND" "Launcher file not found at ${launcher_file}"
    else
      log_error "Launcher file not found at ${launcher_file}"
    fi
    exit $EXIT_NOT_FOUND
  fi

  if [ "$JSON_MODE" = "true" ]; then
    json_success "{
      \"fixed\": true,
      \"windowsUser\": \"$win_user\",
      \"antigravityBase\": \"$antigravity_base\",
      \"scriptsDeployed\": \"$ext_scripts_dir\",
      \"launcherPatched\": \"$launcher_file\"
    }"
  else
    echo ""
    log_success "Antigravity configuration updated!"
    echo ""
    log_info "Please restart Antigravity and try connecting to WSL."
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

# Define NETWORK_ERROR if not in helpers
EXIT_NETWORK_ERROR="${EXIT_NETWORK_ERROR:-11}"

# Run fix
fix_antigravity
