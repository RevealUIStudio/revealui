#!/bin/bash
# =============================================================================
# Shell Script Helpers
# =============================================================================
# Shared utilities for RevealUI shell scripts providing:
# - --json flag for machine-readable output
# - --no-color flag to disable ANSI colors
# - Consistent exit codes
# - Output formatting functions
#
# Usage:
#   source "$(dirname "$0")/_helpers.sh"
#   parse_common_flags "$@"
#   shift $PARSED_ARGS_COUNT
#
# =============================================================================

# Exit codes (matching TypeScript ErrorCode enum)
EXIT_SUCCESS=0
EXIT_GENERAL_ERROR=1
EXIT_CONFIG_ERROR=2
EXIT_EXECUTION_ERROR=3
EXIT_VALIDATION_ERROR=4
EXIT_TIMEOUT_ERROR=5
EXIT_NOT_FOUND=6
EXIT_PERMISSION_DENIED=7
EXIT_CONFLICT=8
EXIT_CANCELLED=9
EXIT_DEPENDENCY_ERROR=10
EXIT_NETWORK_ERROR=11
EXIT_RATE_LIMITED=12
EXIT_INVALID_STATE=13

# Global flags (set by parse_common_flags)
JSON_MODE=false
NO_COLOR=false
VERBOSE=false
FORCE=false
PARSED_ARGS_COUNT=0

# Colors (may be disabled by --no-color or non-TTY)
setup_colors() {
  if [ "$NO_COLOR" = "true" ] || [ ! -t 1 ]; then
    RED=''
    GREEN=''
    YELLOW=''
    BLUE=''
    CYAN=''
    MAGENTA=''
    BOLD=''
    DIM=''
    NC=''
  else
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    CYAN='\033[0;36m'
    MAGENTA='\033[0;35m'
    BOLD='\033[1m'
    DIM='\033[2m'
    NC='\033[0m'
  fi
}

# Parse common flags from arguments
# Sets: JSON_MODE, NO_COLOR, VERBOSE, FORCE, PARSED_ARGS_COUNT
parse_common_flags() {
  PARSED_ARGS_COUNT=0
  local args=("$@")
  local remaining=()

  for arg in "${args[@]}"; do
    case "$arg" in
      --json|-j)
        JSON_MODE=true
        ((PARSED_ARGS_COUNT++))
        ;;
      --no-color)
        NO_COLOR=true
        ((PARSED_ARGS_COUNT++))
        ;;
      --verbose|-v)
        VERBOSE=true
        ((PARSED_ARGS_COUNT++))
        ;;
      --force|-f)
        FORCE=true
        ((PARSED_ARGS_COUNT++))
        ;;
      *)
        remaining+=("$arg")
        ;;
    esac
  done

  # Reinitialize colors based on flags
  setup_colors

  # Export remaining args for caller to use
  REMAINING_ARGS=("${remaining[@]}")
}

# =============================================================================
# Logging Functions (human mode only)
# =============================================================================

log_info() {
  if [ "$JSON_MODE" = "false" ]; then
    echo -e "${BLUE}[INFO]${NC} $1"
  fi
}

log_success() {
  if [ "$JSON_MODE" = "false" ]; then
    echo -e "${GREEN}[OK]${NC} $1"
  fi
}

log_warning() {
  if [ "$JSON_MODE" = "false" ]; then
    echo -e "${YELLOW}[WARN]${NC} $1"
  fi
}

log_error() {
  if [ "$JSON_MODE" = "false" ]; then
    echo -e "${RED}[ERROR]${NC} $1" >&2
  fi
}

log_debug() {
  if [ "$JSON_MODE" = "false" ] && [ "$VERBOSE" = "true" ]; then
    echo -e "${DIM}[DEBUG]${NC} $1"
  fi
}

log_header() {
  if [ "$JSON_MODE" = "false" ]; then
    local text="$1"
    local len=${#text}
    local line=$(printf '=%.0s' $(seq 1 $((len + 4))))
    echo -e "\n${CYAN}${line}"
    echo -e "| ${text} |"
    echo -e "${line}${NC}\n"
  fi
}

log_divider() {
  if [ "$JSON_MODE" = "false" ]; then
    echo -e "${DIM}$(printf '─%.0s' $(seq 1 60))${NC}"
  fi
}

# =============================================================================
# JSON Output Functions
# =============================================================================

# Start JSON output (call once at the beginning)
json_start() {
  if [ "$JSON_MODE" = "true" ]; then
    echo "{"
  fi
}

# End JSON output (call once at the end)
json_end() {
  if [ "$JSON_MODE" = "true" ]; then
    echo "}"
  fi
}

# Output a JSON key-value pair (string)
json_string() {
  local key="$1"
  local value="$2"
  local comma="${3:-true}"
  if [ "$JSON_MODE" = "true" ]; then
    # Escape special characters in value
    value=$(echo "$value" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\t/\\t/g')
    if [ "$comma" = "true" ]; then
      echo "  \"$key\": \"$value\","
    else
      echo "  \"$key\": \"$value\""
    fi
  fi
}

# Output a JSON key-value pair (number)
json_number() {
  local key="$1"
  local value="$2"
  local comma="${3:-true}"
  if [ "$JSON_MODE" = "true" ]; then
    if [ "$comma" = "true" ]; then
      echo "  \"$key\": $value,"
    else
      echo "  \"$key\": $value"
    fi
  fi
}

# Output a JSON key-value pair (boolean)
json_bool() {
  local key="$1"
  local value="$2"
  local comma="${3:-true}"
  if [ "$JSON_MODE" = "true" ]; then
    if [ "$comma" = "true" ]; then
      echo "  \"$key\": $value,"
    else
      echo "  \"$key\": $value"
    fi
  fi
}

# Output a JSON array start
json_array_start() {
  local key="$1"
  if [ "$JSON_MODE" = "true" ]; then
    echo "  \"$key\": ["
  fi
}

# Output a JSON array end
json_array_end() {
  local comma="${1:-true}"
  if [ "$JSON_MODE" = "true" ]; then
    if [ "$comma" = "true" ]; then
      echo "  ],"
    else
      echo "  ]"
    fi
  fi
}

# Output a JSON array item (string)
json_array_item() {
  local value="$1"
  local last="${2:-false}"
  if [ "$JSON_MODE" = "true" ]; then
    value=$(echo "$value" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\t/\\t/g')
    if [ "$last" = "true" ]; then
      echo "    \"$value\""
    else
      echo "    \"$value\","
    fi
  fi
}

# Output a complete JSON success response
json_success() {
  local data="$1"
  if [ "$JSON_MODE" = "true" ]; then
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    cat << EOF
{
  "success": true,
  "data": $data,
  "metadata": {
    "timestamp": "$timestamp"
  }
}
EOF
  fi
}

# Output a complete JSON error response
json_error() {
  local code="$1"
  local message="$2"
  if [ "$JSON_MODE" = "true" ]; then
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    # Escape message
    message=$(echo "$message" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\t/\\t/g')
    cat << EOF
{
  "success": false,
  "error": {
    "code": "$code",
    "message": "$message"
  },
  "metadata": {
    "timestamp": "$timestamp"
  }
}
EOF
  fi
}

# =============================================================================
# Utility Functions
# =============================================================================

# Check if a command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Confirm action (skipped in JSON mode or with --force)
confirm() {
  local message="$1"
  local default="${2:-N}"

  if [ "$JSON_MODE" = "true" ] || [ "$FORCE" = "true" ]; then
    return 0
  fi

  if [ "$default" = "Y" ]; then
    read -p "$message (Y/n): " -n 1 -r
  else
    read -p "$message (y/N): " -n 1 -r
  fi
  echo

  if [ "$default" = "Y" ]; then
    [[ ! $REPLY =~ ^[Nn]$ ]]
  else
    [[ $REPLY =~ ^[Yy]$ ]]
  fi
}

# Initialize colors on source
setup_colors
