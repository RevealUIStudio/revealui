#!/usr/bin/env bash
# =============================================================================
# Vultr Model Verification Script
# =============================================================================
# Diagnostic script to verify a Vultr Serverless Inference model is available
# - Prefers using the official `vultr-cli` Docker image when available
# - Falls back to a direct HTTP probe to the configured Vultr inference endpoint
#
# Usage:
#   ./scripts/agent/check-vultr-model.sh [options]
#
# Options:
#   --json       Output in JSON format (for automation)
#   --no-color   Disable colored output
#   --verbose    Show detailed output
#
# Environment Variables:
#   VULTR_API_KEY  - Vultr API key (required)
#   VULTR_MODEL    - Model identifier (required)
#   VULTR_BASE_URL - Base URL (default: https://api.vultrinference.com/v1)
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
HELPERS_DIR="$SCRIPT_DIR/vultr-helpers"
ENV_FILE="$ROOT_DIR/.env"

# Source helpers
source "$SCRIPT_DIR/_helpers.sh"

# Temp file helper
TMP_OUT=""
cleanup() {
  if [ -n "$TMP_OUT" ] && [ -f "$TMP_OUT" ]; then
    rm -f "$TMP_OUT"
  fi
}
trap cleanup EXIT

# Safely extract an env var from .env without sourcing (avoid unescaped & etc.)
read_env() {
  local key="$1"
  if [ -n "${!key-}" ]; then
    echo "${!key}"
    return
  fi
  if [ -f "$ENV_FILE" ]; then
    grep -m1 "^${key}=" "$ENV_FILE" | sed "s/^${key}=//"
  fi
}

show_help() {
  if [ "$JSON_MODE" = "true" ]; then
    json_success '{"command": "help", "message": "Use --help without --json for usage information"}'
    exit $EXIT_SUCCESS
  fi

  cat << 'EOF'
Vultr Model Verification Script

Usage: ./scripts/agent/check-vultr-model.sh [options]

Options:
  --json       Output in JSON format (for automation)
  --no-color   Disable colored output
  --verbose    Show detailed output

Environment Variables:
  VULTR_API_KEY  - Vultr API key (required)
  VULTR_MODEL    - Model identifier (required)
  VULTR_BASE_URL - Base URL (default: https://api.vultrinference.com/v1)

Example:
  VULTR_API_KEY=xxx VULTR_MODEL=llama-3 ./scripts/agent/check-vultr-model.sh
  ./scripts/agent/check-vultr-model.sh --json
EOF
}

check_model() {
  local VULTR_API_KEY
  local VULTR_MODEL
  local VULTR_BASE_URL

  VULTR_API_KEY="$(read_env VULTR_API_KEY)"
  VULTR_MODEL="$(read_env VULTR_MODEL)"
  VULTR_BASE_URL="$(read_env VULTR_BASE_URL)"

  : "${VULTR_BASE_URL:=https://api.vultrinference.com/v1}"

  # Validate required variables
  if [ -z "$VULTR_API_KEY" ]; then
    if [ "$JSON_MODE" = "true" ]; then
      json_error "CONFIG_ERROR" "VULTR_API_KEY is not set (export or add to .env)"
      exit $EXIT_CONFIG_ERROR
    else
      log_error "VULTR_API_KEY is not set (export or add to .env)"
      exit $EXIT_CONFIG_ERROR
    fi
  fi

  if [ -z "$VULTR_MODEL" ]; then
    if [ "$JSON_MODE" = "true" ]; then
      json_error "CONFIG_ERROR" "VULTR_MODEL is not set (export or add to .env)"
      exit $EXIT_CONFIG_ERROR
    else
      log_error "VULTR_MODEL is not set (export or add to .env)"
      exit $EXIT_CONFIG_ERROR
    fi
  fi

  log_info "Checking Vultr model availability"
  log_debug "VULTR_BASE_URL=$VULTR_BASE_URL"
  log_debug "VULTR_MODEL=$VULTR_MODEL"

  # Check if Python helper scripts exist
  local check_model_script="$HELPERS_DIR/check_model.py"
  local extract_ids_script="$HELPERS_DIR/extract_ids.py"
  local USE_INLINE_PYTHON=false

  if [ ! -f "$check_model_script" ] || [ ! -f "$extract_ids_script" ]; then
    log_debug "Helper scripts not found in $HELPERS_DIR, using inline Python"
    USE_INLINE_PYTHON=true
  fi

  local found_via_cli=false
  local found_via_http=false
  local http_status=""

  # Try vultr-cli via Docker first
  if command -v docker >/dev/null 2>&1; then
    log_info "Attempting to use vultr-cli via Docker to list inference subscriptions..."
    TMP_OUT=$(mktemp)
    docker run --rm -e VULTR_API_KEY="$VULTR_API_KEY" vultr/vultr-cli:latest inference list -o json >"$TMP_OUT" 2>/dev/null || true

    if [ -s "$TMP_OUT" ]; then
      log_debug "vultr-cli inference list output received"

      # Try to find the model anywhere in the list JSON
      if [ "$USE_INLINE_PYTHON" = "true" ]; then
        if python3 -c "
import sys, json
try:
  with open('$TMP_OUT', 'r') as f:
    data = json.load(f)
except Exception:
  sys.exit(2)
def contains_model(obj):
  if isinstance(obj, dict):
    for k,v in obj.items():
      if isinstance(v, str) and '$VULTR_MODEL' in v:
        return True
      if contains_model(v):
        return True
  elif isinstance(obj, list):
    for item in obj:
      if contains_model(item):
        return True
  return False
sys.exit(0 if contains_model(data) else 1)
" 2>/dev/null; then
          found_via_cli=true
          log_success "Found $VULTR_MODEL in vultr-cli inference list output"
        fi
      else
        if python3 "$check_model_script" "$TMP_OUT" "$VULTR_MODEL" 2>/dev/null; then
          found_via_cli=true
          log_success "Found $VULTR_MODEL in vultr-cli inference list output"
        fi
      fi
    else
      log_debug "vultr-cli returned no output; falling back to HTTP probe"
    fi
  else
    log_debug "Docker not available; falling back to direct HTTP probe."
  fi

  # Try direct HTTP probe if not found via CLI
  if [ "$found_via_cli" = "false" ]; then
    log_info "Trying a direct inference probe via HTTP POST to \"$VULTR_BASE_URL/chat/completions\""

    local HTTP_RES
    HTTP_RES=$(curl -sS -w "\n%{http_code}" -X POST "$VULTR_BASE_URL/chat/completions" \
      -H "Authorization: Bearer $VULTR_API_KEY" \
      -H "Content-Type: application/json" \
      -d "{\"model\":\"$VULTR_MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"Hello\"}],\"temperature\":0}" \
      --max-time 15 2>/dev/null) || true

    local HTTP_BODY
    local HTTP_CODE
    HTTP_BODY=$(echo "$HTTP_RES" | sed '$d')
    HTTP_CODE=$(echo "$HTTP_RES" | tail -n1)
    http_status="$HTTP_CODE"

    log_debug "HTTP status: $HTTP_CODE"

    if [ "$HTTP_CODE" = "200" ]; then
      found_via_http=true
      log_success "Vultr model responded successfully"
    else
      log_debug "HTTP probe returned status $HTTP_CODE"
    fi
  fi

  # Output results
  local available=false
  if [ "$found_via_cli" = "true" ] || [ "$found_via_http" = "true" ]; then
    available=true
  fi

  if [ "$JSON_MODE" = "true" ]; then
    json_success "{
      \"model\": \"$VULTR_MODEL\",
      \"baseUrl\": \"$VULTR_BASE_URL\",
      \"available\": $available,
      \"foundViaCli\": $found_via_cli,
      \"foundViaHttp\": $found_via_http,
      \"httpStatus\": $([ -n "$http_status" ] && echo "$http_status" || echo "null")
    }"
  else
    log_header "Vultr Model Check"

    echo "Model: $VULTR_MODEL"
    echo "Base URL: $VULTR_BASE_URL"
    echo ""

    if [ "$available" = "true" ]; then
      log_success "Model is available"
      if [ "$found_via_cli" = "true" ]; then
        echo "  Found via: vultr-cli"
      fi
      if [ "$found_via_http" = "true" ]; then
        echo "  Found via: HTTP probe (status $http_status)"
      fi
    else
      log_error "Model not available"
      if [ -n "$http_status" ]; then
        echo "  HTTP status: $http_status"
      fi
    fi
  fi

  if [ "$available" = "true" ]; then
    exit $EXIT_SUCCESS
  else
    exit $EXIT_EXECUTION_ERROR
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

# Run the check
check_model
