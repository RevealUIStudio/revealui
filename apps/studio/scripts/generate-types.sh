#!/bin/bash
# Generate TypeScript type bindings from Rust structs via ts-rs.
#
# Usage:
#   bash apps/studio/scripts/generate-types.sh
#
# This runs `cargo test` in src-tauri/ which triggers ts-rs to write
# .ts files into src-tauri/bindings/, then copies them to src/generated/.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
STUDIO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TAURI_DIR="$STUDIO_DIR/src-tauri"
GENERATED_DIR="$STUDIO_DIR/src/generated"

echo "==> Running cargo test to generate ts-rs bindings..."
cd "$TAURI_DIR"
cargo test export_bindings -- --ignored 2>/dev/null || cargo test 2>&1

echo "==> Copying bindings to $GENERATED_DIR..."
mkdir -p "$GENERATED_DIR"

# Copy all generated .ts files
if [ -d "$TAURI_DIR/bindings" ] && [ "$(ls -A "$TAURI_DIR/bindings"/*.ts 2>/dev/null)" ]; then
    cp "$TAURI_DIR/bindings"/*.ts "$GENERATED_DIR/"
    echo "==> Copied $(ls "$TAURI_DIR/bindings"/*.ts | wc -l) type files."
else
    echo "==> Warning: No .ts files found in $TAURI_DIR/bindings/"
    echo "    This is expected if cargo test hasn't been run yet."
    echo "    The bindings will be generated when cargo test runs in a"
    echo "    full Tauri build environment."
fi

echo "==> Done."
