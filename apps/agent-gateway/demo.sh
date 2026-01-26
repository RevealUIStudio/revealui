#!/usr/bin/env bash
set -euo pipefail

# Simple demo script to test the Agent Gateway locally
# Usage: ./apps/agent-gateway/demo.sh

ENDPOINT=${ENDPOINT:-http://localhost:3000/v1/chat/completions}

curl -sS -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Give me a one-sentence summary of RevealUI"}]}' | jq
