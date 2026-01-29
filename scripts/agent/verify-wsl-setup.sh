#!/bin/bash
# =============================================================================
# WSL Setup Verification Script
# =============================================================================
# Run this in your WSL terminal (Ubuntu) to verify configuration
#
# Usage:
#   ./scripts/agent/verify_wsl_setup.sh [options]
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
WSL Setup Verification Script

Run this in your WSL terminal (Ubuntu) to verify configuration.

Usage: ./scripts/agent/verify_wsl_setup.sh [options]

Options:
  --json       Output in JSON format (for automation)
  --no-color   Disable colored output
  --verbose    Show detailed output

Checks:
  1. /etc/wsl.conf interop settings
  2. ~/.local/bin/agy wrapper script
  3. System clock synchronization
EOF
}

check_wsl_conf() {
  local status="unknown"
  local has_interop=false
  local has_append_path=false
  local exists=false
  local content=""

  if [ -f /etc/wsl.conf ]; then
    exists=true
    content=$(cat /etc/wsl.conf 2>/dev/null || echo "")

    if grep -q "enabled=true" /etc/wsl.conf 2>/dev/null; then
      has_interop=true
    fi

    if grep -q "appendWindowsPath=true" /etc/wsl.conf 2>/dev/null; then
      has_append_path=true
    fi

    if [ "$has_interop" = "true" ] && [ "$has_append_path" = "true" ]; then
      status="ok"
    else
      status="incomplete"
    fi
  else
    status="missing"
  fi

  if [ "$JSON_MODE" = "false" ]; then
    echo "Checking /etc/wsl.conf..."
    if [ "$status" = "ok" ]; then
      log_success "/etc/wsl.conf has interop enabled"
    elif [ "$status" = "incomplete" ]; then
      log_warning "/etc/wsl.conf exists but may be missing settings."
      cat /etc/wsl.conf
    else
      log_error "/etc/wsl.conf not found"
    fi
    echo ""
  fi

  # Return values via global vars for JSON output
  WSL_CONF_STATUS="$status"
  WSL_CONF_EXISTS="$exists"
  WSL_CONF_HAS_INTEROP="$has_interop"
  WSL_CONF_HAS_APPEND_PATH="$has_append_path"
}

check_agy_wrapper() {
  local status="unknown"
  local exists=false
  local executable=false

  if [ -f ~/.local/bin/agy ]; then
    exists=true
    if [ -x ~/.local/bin/agy ]; then
      executable=true
      status="ok"
    else
      status="not_executable"
    fi
  else
    status="missing"
  fi

  if [ "$JSON_MODE" = "false" ]; then
    echo "Checking ~/.local/bin/agy wrapper..."
    if [ "$exists" = "true" ]; then
      log_success "~/.local/bin/agy exists"
      if [ "$executable" = "true" ]; then
        log_success "~/.local/bin/agy is executable"
      else
        log_error "~/.local/bin/agy is NOT executable (run: chmod +x ~/.local/bin/agy)"
      fi
    else
      log_error "~/.local/bin/agy NOT found"
    fi
    echo ""
  fi

  # Return values via global vars for JSON output
  AGY_STATUS="$status"
  AGY_EXISTS="$exists"
  AGY_EXECUTABLE="$executable"
}

check_system_clock() {
  local current_time
  current_time=$(date -Iseconds)

  if [ "$JSON_MODE" = "false" ]; then
    echo "Checking system clock..."
    echo "Current WSL time: $current_time"
    echo "Note: If this time is significantly different from your Windows clock, run: sudo ntpdate time.windows.com"
    echo ""
  fi

  # Return value via global var for JSON output
  SYSTEM_TIME="$current_time"
}

run_verification() {
  if [ "$JSON_MODE" = "false" ]; then
    log_header "WSL Configuration Check"
  fi

  check_wsl_conf
  check_agy_wrapper
  check_system_clock

  # Determine overall status
  local overall_status="ok"
  local issues=0

  if [ "$WSL_CONF_STATUS" != "ok" ]; then
    overall_status="issues"
    ((issues++))
  fi

  if [ "$AGY_STATUS" != "ok" ]; then
    overall_status="issues"
    ((issues++))
  fi

  if [ "$JSON_MODE" = "true" ]; then
    json_success "{
      \"overallStatus\": \"$overall_status\",
      \"issueCount\": $issues,
      \"checks\": {
        \"wslConf\": {
          \"status\": \"$WSL_CONF_STATUS\",
          \"exists\": $WSL_CONF_EXISTS,
          \"hasInterop\": $WSL_CONF_HAS_INTEROP,
          \"hasAppendPath\": $WSL_CONF_HAS_APPEND_PATH
        },
        \"agyWrapper\": {
          \"status\": \"$AGY_STATUS\",
          \"exists\": $AGY_EXISTS,
          \"executable\": $AGY_EXECUTABLE
        },
        \"systemClock\": {
          \"currentTime\": \"$SYSTEM_TIME\"
        }
      }
    }"
  else
    log_divider
    if [ "$overall_status" = "ok" ]; then
      log_success "All checks passed"
    else
      log_warning "Check complete with $issues issue(s)"
    fi
  fi

  if [ "$overall_status" = "ok" ]; then
    exit $EXIT_SUCCESS
  else
    exit $EXIT_VALIDATION_ERROR
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

# Run verification
run_verification
