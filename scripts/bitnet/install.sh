#!/usr/bin/env bash
# BitNet install script — clones, compiles, and downloads the model.
# Requires: clang 18, cmake, ninja, python3, huggingface-cli (all in Nix devshell).
# Usage: pnpm bitnet:install [--rebuild]
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BITNET_DIR="$REPO_ROOT/.bitnet"
MODEL_ID="microsoft/bitnet-b1.58-2B-4T-gguf"
MODEL_FILE="bitnet-b1.58-2B-4T-bf16.gguf"

REBUILD=0
for arg in "$@"; do
  [ "$arg" = "--rebuild" ] && REBUILD=1
done

# ── Check AVX2 ────────────────────────────────────────────────────────────────
if [ -f /proc/cpuinfo ]; then
  if ! grep -qm1 avx2 /proc/cpuinfo; then
    echo "❌ AVX2 not found in /proc/cpuinfo. BitNet requires AVX2 (any CPU from 2013+)."
    exit 1
  fi
fi

# ── Check clang ───────────────────────────────────────────────────────────────
if ! command -v clang &>/dev/null; then
  echo "❌ clang not found. Enter the Nix devshell first: direnv allow"
  exit 1
fi

CLANG_VERSION=$(clang --version 2>/dev/null | head -1 | grep -oP '\d+\.\d+' | head -1 | cut -d. -f1)
if [ "${CLANG_VERSION:-0}" -lt 18 ]; then
  echo "❌ clang 18+ required (found: clang ${CLANG_VERSION:-unknown}). Enter the Nix devshell."
  exit 1
fi

# ── Clone or update BitNet ────────────────────────────────────────────────────
if [ ! -d "$BITNET_DIR" ]; then
  echo "📦 Cloning microsoft/BitNet..."
  git clone --depth=1 https://github.com/microsoft/BitNet "$BITNET_DIR"
elif [ "$REBUILD" = 1 ]; then
  echo "🔄 Updating BitNet repository..."
  git -C "$BITNET_DIR" pull --ff-only
fi

# ── Build ─────────────────────────────────────────────────────────────────────
if [ ! -f "$BITNET_DIR/build/bin/llama-server" ] || [ "$REBUILD" = 1 ]; then
  echo "🔨 Compiling BitNet (this takes 5–10 minutes on first run)..."
  cd "$BITNET_DIR"
  python setup_env.py \
    --model-dir "$BITNET_DIR/models" \
    -q i2_s \
    --build-dir "$BITNET_DIR/build" \
    2>&1 | tail -20
  echo "✅ BitNet compiled"
else
  echo "✅ BitNet already compiled (use --rebuild to recompile)"
fi

# ── Download model ────────────────────────────────────────────────────────────
MODEL_PATH="$BITNET_DIR/models/$MODEL_FILE"
if [ ! -f "$MODEL_PATH" ]; then
  if ! command -v huggingface-cli &>/dev/null; then
    echo "❌ huggingface-cli not found. Enter the Nix devshell: direnv allow"
    exit 1
  fi
  echo "⬇️  Downloading $MODEL_ID (~1.19 GB)..."
  mkdir -p "$BITNET_DIR/models"
  huggingface-cli download "$MODEL_ID" "$MODEL_FILE" --local-dir "$BITNET_DIR/models"
  echo "✅ Model downloaded to $MODEL_PATH"
else
  echo "✅ Model already downloaded"
fi

echo ""
echo "🚀 BitNet ready. Start inference with: pnpm bitnet:serve"
