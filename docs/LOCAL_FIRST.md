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
| **Inference snaps / Ollama** | Local LLM inference (OpenAI-compatible, open models) |
| **RevVault** | Age-encrypted local secret store |
| **RevealUI Pro** | Business logic, AI agents, MCP integrations |

## Hardware requirements

- **CPU:** x86-64 or ARM64
- **RAM:** 4 GB minimum, 8 GB recommended
- **Disk:** ~2 GB free (model weights + runtime)
- **OS:** Linux, macOS, or WSL2 (Ubuntu 22.04+)

## Step 1 — Nix + direnv

Nix provides all build dependencies automatically.

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

The Nix flake activates: Node 24, pnpm 10, Biome, and all build dependencies are available without any other installs.

## Step 2 — Local inference (inference snaps or Ollama)

**Option A: Ubuntu Inference Snaps (recommended)**

Inference snaps are the primary recommended path for local AI. Canonical's snap-packaged model serving provides hardware-aware engine selection, signed packages, and zero configuration:

```bash
sudo snap install nemotron-3-nano   # general-purpose, low resource
# or: sudo snap install gemma3      # general + vision
```

Verify the snap is running:
```bash
nemotron-3-nano status
```

Each snap serves an OpenAI-compatible API at `http://localhost:<port>/v1`.

**Option B: Ollama (fallback)**

Install Ollama, then pull a model:
```bash
ollama serve &
ollama pull gemma4:e2b
ollama pull nomic-embed-text   # for embeddings
```

Add to `.envrc`:
```bash
export OLLAMA_BASE_URL=http://localhost:11434
```

## Step 3 — Configure `@revealui/ai`

The `createLLMClientFromEnv()` function in `@revealui/ai` auto-detects the available inference backend. No API key is needed for local inference.

Auto-detection priority: `INFERENCE_SNAPS_BASE_URL` > `OLLAMA_BASE_URL`.

```typescript
import { createLLMClientFromEnv } from '@revealui/ai/llm';

// Automatically detects inference snaps or Ollama
const client = createLLMClientFromEnv();
```

## Step 4 — Embeddings

For vector search and AI memory, use Ollama with an embedding model:

```bash
ollama pull nomic-embed-text
```

Add to `.envrc`:
```bash
export OLLAMA_BASE_URL=http://localhost:11434
# Optional: use a different embed model
# export OLLAMA_EMBED_MODEL=nomic-embed-text
```

Alternatively, use `@xenova/transformers` for fully offline embeddings (no server):

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

## Step 5 — RevVault setup

RevVault stores all other project secrets (database URLs, Stripe keys, Google service account key):

```bash
# Initialize (first time)
revvault init

# Store your secrets
revvault set revealui/db/postgres-url
revvault set revealui/stripe/secret-key
revvault set revealui/google/private-key

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
# Local inference is already running (snap or Ollama)

# Start RevealUI (uses local inference automatically)
pnpm dev:app
```

Or use Studio to manage services, agents, and local inference from a native desktop interface.

## Verifying local inference

In the admin admin dashboard, navigate to **Admin → AI → Agent Tasks** and run a test task. You should see the inference request handled locally with no outbound network traffic to any AI provider.

## Troubleshooting

**Snap install fails**
Ensure `snapd` is installed and running. On WSL2, snap support requires systemd (`systemctl` must work).

**Ollama model pull fails**
Check that `ollama serve` is running and accessible at `http://localhost:11434`.

**Port conflict**
If the default port is already in use, configure a different port in the snap or Ollama settings and update the corresponding `*_BASE_URL` env var.

## Offline operation

Once models are downloaded, the inference stack works with no network connection. The only components that require network access at runtime are:

- Database (NeonDB) — can be replaced with local Postgres
- Email delivery (Gmail API) — no offline fallback
- Stripe webhooks — requires Stripe CLI (`stripe listen`) for local testing

For a fully offline database, use the local Postgres instance provided by the RevealUI devcontainer or configure `POSTGRES_URL` to point to a local Postgres server.
