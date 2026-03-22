#!/usr/bin/env bash
# BitNet inference server — starts llama-server with an OpenAI-compatible API.
# Usage: pnpm bitnet:serve [--port 8080]
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BITNET_DIR="$REPO_ROOT/.bitnet"
MODEL_FILE="bitnet-b1.58-2B-4T-bf16.gguf"
MODEL_PATH="$BITNET_DIR/models/$MODEL_FILE"
LLAMA_SERVER="$BITNET_DIR/build/bin/llama-server"

PORT=8080
for arg in "$@"; do
  case "$arg" in
    --port) shift; PORT="$1" ;;
    --port=*) PORT="${arg#--port=}" ;;
  esac
done

# ── Preflight checks ──────────────────────────────────────────────────────────
if [ ! -f "$LLAMA_SERVER" ]; then
  echo "❌ llama-server not found. Run: pnpm bitnet:install"
  exit 1
fi

if [ ! -f "$MODEL_PATH" ]; then
  echo "❌ Model not found at $MODEL_PATH. Run: pnpm bitnet:install"
  exit 1
fi

# Check if port is already in use
if command -v lsof &>/dev/null && lsof -ti:"$PORT" &>/dev/null; then
  echo "❌ Port $PORT is already in use."
  echo "   Use a different port: pnpm bitnet:serve --port 8081"
  echo "   Then set: BITNET_BASE_URL=http://localhost:8081"
  exit 1
fi

echo "🚀 Starting BitNet inference server on http://localhost:$PORT"
echo "   Model: $MODEL_FILE"
echo "   API:   http://localhost:$PORT/v1/chat/completions (OpenAI-compatible)"
echo "   Stop:  Ctrl+C"
echo ""

exec "$LLAMA_SERVER" \
  --model "$MODEL_PATH" \
  --port "$PORT" \
  --host 127.0.0.1 \
  --ctx-size 4096 \
  --n-predict -1 \
  --log-disable
