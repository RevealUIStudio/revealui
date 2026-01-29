#!/usr/bin/env bash
set -euo pipefail

# Diagnostic script to verify a Vultr Serverless Inference model is available
# - Prefers using the official `vultr-cli` Docker image when available
# - Falls back to a direct HTTP probe to the configured Vultr inference endpoint

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
HELPERS_DIR="$SCRIPT_DIR/vultr-helpers"
ENV_FILE="$ROOT_DIR/.env"

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

VULTR_API_KEY="$(read_env VULTR_API_KEY)"
VULTR_MODEL="$(read_env VULTR_MODEL)"
VULTR_BASE_URL="$(read_env VULTR_BASE_URL)"

: ${VULTR_BASE_URL:="https://api.vultrinference.com/v1"}

if [ -z "$VULTR_API_KEY" ]; then
  echo "ERROR: VULTR_API_KEY is not set (export or add to .env)" >&2
  exit 2
fi

if [ -z "$VULTR_MODEL" ]; then
  echo "ERROR: VULTR_MODEL is not set (export or add to .env)" >&2
  exit 2
fi

echo "Checking Vultr model availability"
echo "  VULTR_BASE_URL=$VULTR_BASE_URL"
echo "  VULTR_MODEL=$VULTR_MODEL"

# Check if Python helper scripts exist
check_model_script="$HELPERS_DIR/check_model.py"
extract_ids_script="$HELPERS_DIR/extract_ids.py"

if [ ! -f "$check_model_script" ] || [ ! -f "$extract_ids_script" ]; then
  echo "WARNING: Helper scripts not found in $HELPERS_DIR, using inline Python" >&2
  USE_INLINE_PYTHON=true
else
  USE_INLINE_PYTHON=false
fi

if command -v docker >/dev/null 2>&1; then
  echo "Attempting to use vultr-cli via Docker to list inference subscriptions..."
  TMP_OUT=$(mktemp)
  docker run --rm -e VULTR_API_KEY="$VULTR_API_KEY" vultr/vultr-cli:latest inference list -o json >"$TMP_OUT" 2>/dev/null || true

  if [ -s "$TMP_OUT" ]; then
    echo "vultr-cli inference list output (truncated):"
    sed -n '1,200p' "$TMP_OUT"

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
"; then
        echo "OK: Found $VULTR_MODEL in vultr-cli inference list output"
        exit 0
      fi
    else
      if python3 "$check_model_script" "$TMP_OUT" "$VULTR_MODEL"; then
        echo "OK: Found $VULTR_MODEL in vultr-cli inference list output"
        exit 0
      fi
    fi

    # Extract subscription ids and check each subscription details
    IDS_FILE=$(mktemp)
    if [ "$USE_INLINE_PYTHON" = "true" ]; then
      python3 -c "
import sys, json
try:
  with open('$TMP_OUT', 'r') as f:
    data = json.load(f)
except Exception:
  sys.exit(0)
ids = []
if isinstance(data, dict):
  subs = data.get('subscriptions') or []
  for s in subs:
    if isinstance(s, dict) and s.get('id'):
      ids.append(s.get('id'))
with open('$IDS_FILE', 'w') as f:
  f.write('\\n'.join(ids))
" || true
    else
      python3 "$extract_ids_script" "$TMP_OUT" "$IDS_FILE" || true
    fi

    if [ -s "$IDS_FILE" ]; then
      echo "Found subscription ids:"
      sed -n '1,200p' "$IDS_FILE"
      while IFS= read -r id; do
        [ -z "$id" ] && continue
        echo "Inspecting subscription $id"
        GETOUT=$(mktemp)
        docker run --rm -e VULTR_API_KEY="$VULTR_API_KEY" vultr/vultr-cli:latest inference get "$id" -o json >"$GETOUT" 2>/dev/null || true
        if [ -s "$GETOUT" ]; then
          sed -n '1,120p' "$GETOUT"
          if [ "$USE_INLINE_PYTHON" = "true" ]; then
            if python3 -c "
import sys, json
try:
  with open('$GETOUT', 'r') as f:
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
"; then
              echo "OK: Found $VULTR_MODEL in subscription $id details"
              rm -f "$GETOUT" "$IDS_FILE"
              exit 0
            fi
          else
            if python3 "$check_model_script" "$GETOUT" "$VULTR_MODEL"; then
              echo "OK: Found $VULTR_MODEL in subscription $id details"
              rm -f "$GETOUT" "$IDS_FILE"
              exit 0
            fi
          fi
        fi
        rm -f "$GETOUT" || true
      done < "$IDS_FILE"
      rm -f "$IDS_FILE" || true
    else
      echo "No subscription ids found to inspect"
    fi
  else
    echo "vultr-cli returned no output; falling back to HTTP probe"
  fi
else
  echo "Docker not available; falling back to direct HTTP probe."
fi

echo "Trying a direct inference probe via HTTP POST to \"$VULTR_BASE_URL/chat/completions\""
HTTP_RES=$(curl -sS -w "\n%{http_code}" -X POST "$VULTR_BASE_URL/chat/completions" \
  -H "Authorization: Bearer $VULTR_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"model\":\"$VULTR_MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"Hello\"}],\"temperature\":0}" \
  --max-time 15)

HTTP_BODY=$(echo "$HTTP_RES" | sed '$d')
HTTP_CODE=$(echo "$HTTP_RES" | tail -n1)

echo "HTTP status: $HTTP_CODE"
echo "Response body excerpt:"
echo "$HTTP_BODY" | sed -n '1,60p'

if [ "$HTTP_CODE" = "200" ]; then
  echo "OK: Vultr model responded successfully"
  exit 0
else
  echo "FAIL: Vultr model probe returned HTTP $HTTP_CODE" >&2
  exit 3
fi
