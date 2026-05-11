#!/bin/bash
# generate-secret.sh
#
# Generates a cryptographically random secret as a hex string. Used by
# RevealUI customer-onboarding docs (QUICK_START, BUILD_YOUR_BUSINESS,
# CI_CD_GUIDE, PRO, ENVIRONMENT-VARIABLES-GUIDE, TROUBLESHOOTING) wherever
# a secret needs to be generated locally.
#
# Centralized here so docs prose can read `bash scripts/generate-secret.sh`
# rather than embedding inline `node -e "..."` recipes that break when a
# customer copy-pastes them through escaping-hostile shells.
#
# Usage:
#     bash scripts/generate-secret.sh           # 32-byte (256-bit) hex
#     bash scripts/generate-secret.sh 64        # 64-byte (512-bit) hex
#
# Output: a single line of lowercase hex, no trailing newline noise.
set -euo pipefail

BYTES="${1:-32}"

# openssl is already required by every supported dev environment (Linux,
# macOS, WSL2, Git Bash on Windows). No node dependency.
if ! command -v openssl >/dev/null 2>&1; then
  echo "error: openssl not found on PATH" >&2
  echo "install with: sudo apt install openssl  (or equivalent)" >&2
  exit 1
fi

openssl rand -hex "$BYTES"
