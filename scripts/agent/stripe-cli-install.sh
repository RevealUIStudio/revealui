#!/bin/bash
# =============================================================================
# Stripe CLI Installation Script
# =============================================================================
# Installs the latest Stripe CLI on Linux systems (WSL2/Ubuntu/Debian)
#
# Usage:
#   ./scripts/agent/stripe-cli-install.sh [options]
#
# Options:
#   --json       Output in JSON format (for automation)
#   --no-color   Disable colored output
#   --force      Skip confirmation prompts
#   --method     Installation method: deb (default) or tarball
#   --verbose    Show detailed output
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/_helpers.sh"

# Additional flags
INSTALL_METHOD="deb"

# Parse additional flags
parse_install_flags() {
  local args=("$@")
  local remaining=()

  for i in "${!args[@]}"; do
    case "${args[$i]}" in
      --method)
        INSTALL_METHOD="${args[$((i+1))]:-deb}"
        ;;
      --method=*)
        INSTALL_METHOD="${args[$i]#*=}"
        ;;
      *)
        # Skip the value after --method
        if [ "$i" -gt 0 ] && [ "${args[$((i-1))]}" = "--method" ]; then
          continue
        fi
        remaining+=("${args[$i]}")
        ;;
    esac
  done

  REMAINING_ARGS=("${remaining[@]}")
}

show_help() {
  if [ "$JSON_MODE" = "true" ]; then
    json_success '{"command": "help", "message": "Use --help without --json for usage information"}'
    exit $EXIT_SUCCESS
  fi

  cat << 'EOF'
Stripe CLI Installation Script

Installs the latest Stripe CLI on Linux systems (WSL2/Ubuntu/Debian)

Usage: ./scripts/agent/stripe-cli-install.sh [options]

Options:
  --json       Output in JSON format (for automation)
  --no-color   Disable colored output
  --force      Skip confirmation prompts
  --method     Installation method: deb (default) or tarball
  --verbose    Show detailed output

Example:
  ./scripts/agent/stripe-cli-install.sh
  ./scripts/agent/stripe-cli-install.sh --force --method=tarball
  ./scripts/agent/stripe-cli-install.sh --json
EOF
}

install_stripe_cli() {
  local current_version=""
  local latest_version=""
  local arch=""
  local arch_type=""
  local tarball_arch=""

  # Check if already installed
  if command -v stripe &> /dev/null; then
    current_version=$(stripe version 2>/dev/null | head -1 || echo "unknown")
    log_info "Stripe CLI is already installed: $current_version"

    if [ "$FORCE" = "false" ] && [ "$JSON_MODE" = "false" ]; then
      if ! confirm "Do you want to reinstall/update?"; then
        log_info "Installation cancelled."
        if [ "$JSON_MODE" = "true" ]; then
          json_success '{"action": "cancelled", "currentVersion": "'"$current_version"'"}'
        fi
        exit $EXIT_CANCELLED
      fi
    fi
  fi

  # Detect architecture
  arch=$(uname -m)
  if [ "$arch" = "x86_64" ]; then
    arch_type="amd64"
    tarball_arch="x86_64"
  elif [ "$arch" = "aarch64" ] || [ "$arch" = "arm64" ]; then
    arch_type="arm64"
    tarball_arch="arm64"
  else
    if [ "$JSON_MODE" = "true" ]; then
      json_error "VALIDATION_ERROR" "Unsupported architecture: $arch"
    else
      log_error "Unsupported architecture: $arch"
    fi
    exit $EXIT_VALIDATION_ERROR
  fi

  log_info "Architecture detected: $arch_type"

  # Get latest version from GitHub API
  log_info "Fetching latest Stripe CLI version..."
  latest_version=$(curl -s https://api.github.com/repos/stripe/stripe-cli/releases/latest | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/' | sed 's/^v//')

  if [ -z "$latest_version" ]; then
    if [ "$JSON_MODE" = "true" ]; then
      json_error "NETWORK_ERROR" "Could not determine latest version"
    else
      log_error "Could not determine latest version. Please install manually."
    fi
    exit $EXIT_NETWORK_ERROR
  fi

  log_success "Latest version: $latest_version"

  # Install based on method
  local installed_version=""
  local install_path=""

  case "$INSTALL_METHOD" in
    deb)
      local deb_file="stripe_${latest_version}_linux_${arch_type}.deb"
      local download_url="https://github.com/stripe/stripe-cli/releases/download/v${latest_version}/${deb_file}"

      log_info "Downloading $deb_file..."
      cd /tmp
      if ! curl -L -o "$deb_file" "$download_url"; then
        if [ "$JSON_MODE" = "true" ]; then
          json_error "NETWORK_ERROR" "Failed to download $deb_file"
        else
          log_error "Failed to download $deb_file"
        fi
        exit $EXIT_NETWORK_ERROR
      fi

      log_info "Installing package..."
      if ! sudo dpkg -i "$deb_file"; then
        log_warning "Fixing dependencies..."
        sudo apt-get install -f -y
      fi

      rm -f "$deb_file"
      install_path="/usr/bin/stripe"
      ;;

    tarball)
      local tar_file="stripe_${latest_version}_linux_${tarball_arch}.tar.gz"
      local download_url="https://github.com/stripe/stripe-cli/releases/download/v${latest_version}/${tar_file}"

      log_info "Downloading $tar_file..."
      cd /tmp
      if ! curl -L -o "$tar_file" "$download_url"; then
        if [ "$JSON_MODE" = "true" ]; then
          json_error "NETWORK_ERROR" "Failed to download $tar_file"
        else
          log_error "Failed to download $tar_file"
        fi
        exit $EXIT_NETWORK_ERROR
      fi

      log_info "Extracting..."
      tar -xzf "$tar_file"

      log_info "Installing to /usr/local/bin..."
      sudo mv stripe /usr/local/bin/
      sudo chmod +x /usr/local/bin/stripe

      rm -f "$tar_file"
      install_path="/usr/local/bin/stripe"
      ;;

    *)
      if [ "$JSON_MODE" = "true" ]; then
        json_error "VALIDATION_ERROR" "Invalid installation method: $INSTALL_METHOD"
      else
        log_error "Invalid installation method: $INSTALL_METHOD"
      fi
      exit $EXIT_VALIDATION_ERROR
      ;;
  esac

  # Verify installation
  if command -v stripe &> /dev/null; then
    installed_version=$(stripe version 2>/dev/null | head -1 || echo "unknown")
    log_success "Stripe CLI installed successfully!"

    if [ "$JSON_MODE" = "true" ]; then
      json_success "{
        \"action\": \"installed\",
        \"version\": \"$installed_version\",
        \"previousVersion\": $([ -n "$current_version" ] && echo "\"$current_version\"" || echo "null"),
        \"method\": \"$INSTALL_METHOD\",
        \"path\": \"$install_path\",
        \"architecture\": \"$arch_type\"
      }"
    else
      echo ""
      echo "Version: $installed_version"
      echo ""
      log_header "Next Steps"
      echo "1. Run: stripe login"
      echo "2. Start webhook forwarding: stripe listen --forward-to localhost:4000/api/webhooks/stripe"
      echo "3. Copy the webhook secret (whsec_...) to your .env file"
      echo ""
      log_info "For more details, see: docs/guides/stripe-sandbox-setup.md"
    fi
  else
    if [ "$JSON_MODE" = "true" ]; then
      json_error "EXECUTION_ERROR" "Installation may have failed"
    else
      log_error "Installation may have failed. Please check the output above."
    fi
    exit $EXIT_EXECUTION_ERROR
  fi
}

# =============================================================================
# Main
# =============================================================================

# Parse common flags
parse_common_flags "$@"
set -- "${REMAINING_ARGS[@]}"

# Parse install-specific flags
parse_install_flags "$@"
set -- "${REMAINING_ARGS[@]}"

# Handle help
if [ "${1:-}" = "help" ] || [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  show_help
  exit $EXIT_SUCCESS
fi

# Define NETWORK_ERROR if not in helpers
EXIT_NETWORK_ERROR="${EXIT_NETWORK_ERROR:-11}"

# Run installation
install_stripe_cli
