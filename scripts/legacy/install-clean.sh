#!/bin/bash
# Clean install script that suppresses Node.js deprecation warnings
# Usage: ./scripts/install-clean.sh

echo "Running clean install with deprecation warnings suppressed..."
NODE_OPTIONS="--no-deprecation" pnpm install
