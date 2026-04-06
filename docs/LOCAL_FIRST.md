---
title: "Local-First Setup"
description: "Development environment setup for local-first development with ElectricSQL"
category: guide
audience: developer
---

# Local-First Setup

Run RevealUI entirely on your own hardware with local AI inference — no proprietary APIs, no remote secret storage, fully reproducible dev environment. Pro tier also supports cloud-hosted open models via the RevealUI harness.

## Overview

The local-first stack uses four components:

| Component | Purpose |
|-----------|---------|
| **Nix + direnv** | Reproducible dev environment — all build deps provided automatically |
| **BitNet** | Local LLM inference (OpenAI-compatible, CPU-only, ~700 MB RAM) |
| **RevVault** | Age-encrypted local secret store |
| **RevealUI Pro** | Business logic, AI agents, MCP integrations |

## Hardware requirements

- **CPU:** x86-64 with AVX2 (any CPU from 2013+), or ARM64 with NEON
- **RAM:** 4 GB minimum, 8 GB recommended (BitNet 2B uses ~700 MB; the rest is for Node.js + OS)
- **Disk:** ~3 GB free (1.19 GB model + BitNet build artifacts)
- **OS:** Linux, macOS, or WSL2 (Ubuntu 22.04+)

Check AVX2 support:
```bash
grep -m1 avx2 /proc/cpuinfo && echo "AVX2 supported" || echo "AVX2 not found"
```

## Step 1 — Nix + direnv

Nix provides all build dependencies including clang 18 (required by BitNet) automatically.

If Nix isn't installed:
```bash
# Single-user install
sh <(curl -L https://nixos.org/nix/install) --no-daemon

# Enable flakes (add to ~/.config/nix/nix.conf)
echo "experimental-features = nix-command flakes" >> ~/.config/nix/nix.conf
```

Install direnv:
```bash
nix-env -iA nixpkgs.direnv
echo 'eval "$(direnv hook bash)"' >> ~/.bashrc  # or ~/.zshrc
```

In the RevealUI directory:
```bash
direnv allow
```

The Nix flake activates: Node 24, pnpm 10, Biome, clang 18, cmake, ninja, Python 3, and `huggingface-cli` are all available without any other installs.

## Step 2 — Install BitNet

With the Nix devshell active:

```bash
pnpm bitnet:install
```

This script:
1. Clones `microsoft/BitNet` into `.bitnet/`
2. Runs `python setup_env.py` (compiles llama-server and BitNet kernels using clang 18 from Nix)
3. Downloads `microsoft/bitnet-b1.58-2B-4T-gguf` (~1.19 GB) via `huggingface-cli`

First run takes 5–10 minutes (compilation). Subsequent runs are instant.

## Step 3 — Start the inference server

```bash
pnpm bitnet:serve
```

This starts `llama-server` on `http://localhost:8080` with an OpenAI-compatible API. You can verify it:

```bash
curl http://localhost:8080/v1/models
# {"data":[{"id":"bitnet-b1.58-2B-4T","object":"model",...}]}
```

## Step 4 — Configure `@revealui/ai`

Set `BITNET_BASE_URL` in your environment. RevVault is the recommended way:

```bash
revvault set revealui/local/bitnet-base-url
# Enter: http://localhost:8080
```

In your `.envrc`:
```bash
export BITNET_BASE_URL=$(revvault get revealui/local/bitnet-base-url)
```

The `createLLMClientFromEnv()` function in `@revealui/ai` auto-detects `BITNET_BASE_URL` and routes all agent calls to the local server. No API key is needed.

```typescript
import { createLLMClientFromEnv } from '@revealui/ai/llm';

// Automatically uses BITNET_BASE_URL if set
const client = createLLMClientFromEnv();
```

## Step 5 — Embeddings

BitNet is a generative model only — it does not support `/v1/embeddings`. For vector search and AI memory, `@revealui/ai` auto-wires Ollama as the embed backend when both `BITNET_BASE_URL` and `OLLAMA_BASE_URL` are set.

**Option A: Ollama (recommended — auto-wired)**

Install Ollama, then pull the embed model:
```bash
ollama serve &
ollama pull nomic-embed-text
```

Add to `.envrc`:
```bash
export OLLAMA_BASE_URL=http://localhost:11434
# Optional: use a different embed model
# export OLLAMA_EMBED_MODEL=nomic-embed-text
```

When both `BITNET_BASE_URL` and `OLLAMA_BASE_URL` are set, `createLLMClientFromEnv()` automatically uses BitNet for chat and Ollama for embeddings — no additional configuration needed.

**Option B: `@xenova/transformers` (fully offline, no server)**

If you can't run an Ollama server, use `@xenova/transformers` directly:

```bash
pnpm add @xenova/transformers
```

```typescript
import { pipeline } from '@xenova/transformers';

const embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
const output = await embedder('Hello world', { pooling: 'mean', normalize: true });
// output.data is a Float32Array of 384 dimensions
```

The model (~90 MB) is downloaded once and cached. Plug it into `@revealui/ai` via the `embedProvider` option on `LLMClient`.

## Step 6 — RevVault setup

RevVault stores all other project secrets (database URLs, Stripe keys, Resend API key):

```bash
# Initialize (first time)
revvault init

# Store your secrets
revvault set revealui/db/postgres-url
revvault set revealui/stripe/secret-key
revvault set revealui/resend/api-key

# Add to .envrc
cat >> .envrc <<'EOF'
eval "$(revvault export-env revealui)"
EOF

direnv allow
```

Secrets are age-encrypted at rest and never written to disk in plaintext during normal operation.

## Running everything

Once set up, the full local-first stack starts with:

```bash
# Terminal 1 — BitNet inference server
pnpm bitnet:serve

# Terminal 2 — RevealUI (uses local inference automatically)
pnpm dev:app
```

Or use Studio to manage services, agents, and local inference from a native desktop interface.

## Verifying local inference

In the CMS admin dashboard, navigate to **Admin → AI → Agent Tasks** and run a test task. Check the server logs in Terminal 1 — you should see the inference request handled locally with no outbound network traffic to any AI provider.

## Troubleshooting

**`avx2` not found in /proc/cpuinfo**
Your CPU does not support AVX2. BitNet will not work. Use Ollama or another local inference runtime instead.

**`setup_env.py` fails with clang not found**
Make sure you entered the Nix devshell (`direnv allow` or `nix develop`). Run `which clang` — it should point to a path in `/nix/store`.

**Inference is very slow (< 1 tok/s)**
You likely built in debug mode. Run `pnpm bitnet:install --rebuild` to force a release build.

**WSL2: slow inference**
Same as above — ensure release build. WSL2 passes AVX2 instructions through to the host CPU correctly in recent versions (kernel 5.15+).

**Port 8080 already in use**
```bash
pnpm bitnet:serve --port 8081
# Then set BITNET_BASE_URL=http://localhost:8081
```

## Offline operation

Once BitNet is installed and the model is downloaded, the inference stack works with no network connection. The only components that require network access at runtime are:

- Database (NeonDB) — can be replaced with local Postgres
- Email delivery (Resend) — no offline fallback
- Stripe webhooks — requires Stripe CLI (`stripe listen`) for local testing

For a fully offline database, use the local Postgres instance provided by the RevealUI devcontainer or configure `POSTGRES_URL` to point to a local Postgres server.
