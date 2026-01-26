#!/usr/bin/env bash
set -euo pipefail

# Example run command for HF TGI container
docker run -d \
  --gpus all \
  -p 8080:80 \
  -e MODEL_ID=${MODEL_ID:-mistralai/Mistral-7B-Instruct-v0.2} \
  ghcr.io/huggingface/text-generation-inference:latest

echo "Started HF TGI container on :8080"
