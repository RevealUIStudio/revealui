# The Air-Gap Capable Business Stack

*By Joshua Vaughn — RevealUI Studio*

---

Most software companies accept a particular bargain without thinking about it: your secrets live in someone else's vault, your AI calls someone else's API, and your dev environment is a pile of global installs that one `npm install -g` can break.

RevealUI doesn't accept that bargain.

This post is about a different way to run a software business — one where your secrets are encrypted on your own machine, your AI inference runs on your CPU, and your development environment is fully reproducible. Not because you're paranoid, but because owning your stack is simply better engineering.

## The four layers

RevealUI's local-first story comes from four independent pieces that happen to compose cleanly:

| Layer | Technology | What it does |
|-------|-----------|-------------|
| **Secrets** | RevVault (age encryption) | Credentials stay on your machine, encrypted at rest |
| **AI inference** | BitNet (1-bit models, CPU-only) | LLM inference with no cloud API, ~700 MB RAM |
| **Dev environment** | Nix flakes + direnv | Reproducible environment, zero manual tool installs |
| **Business logic** | RevealUI Pro | Auth, content, payments, AI agents — all wired |

Each layer independently solves a real problem. Together, they give you something genuinely unusual: a full AI-powered business software stack that can run without a network connection.

## RevVault: secrets that don't travel

RevealUI uses [RevVault](https://github.com/RevealUIStudio/revvault) for credential management. RevVault is an age-encrypted local secret store — a Git-friendly vault that keeps secrets on your filesystem, encrypted, and never phones home.

```bash
# Store a secret
revvault set my-project/stripe/secret-key

# Retrieve it
revvault get my-project/stripe/secret-key

# Load into environment (used by .envrc)
revvault export-env my-project > .env.local
```

The practical upside: your `.env` never touches Vercel's secret storage, your CI system, or any third-party dashboard unless you put it there explicitly. The `.envrc` in every RevealUI project calls `revvault export-env` at shell entry — credentials are decrypted on the fly, used in memory, never written to disk in plaintext.

Contrast this with the standard pattern: secrets in Vercel, AWS Secrets Manager, or a `.env` file checked into a private repo. All three involve trusting a third party with values that should only exist on hardware you control.

## BitNet: AI inference that stays on your machine

[BitNet](https://github.com/microsoft/BitNet) is Microsoft's 1-bit quantization framework. The flagship model — `bitnet-b1.58-2B-4T` — is a 2.4B parameter instruction-tuned model that fits in **1.19 GB on disk** and uses roughly **700 MB of RAM** at runtime.

That's not a toy. The 1-bit quantization in BitNet is trained from scratch (not post-quantized), which preserves quality in a way that standard int4 quantization can't match at this size. It runs at usable speed on a standard AVX2 CPU — no GPU, no CUDA, no driver hell.

For RevealUI, this means your AI agents run locally:

```bash
# Start the BitNet inference server (port 8080, OpenAI-compatible)
pnpm bitnet:serve

# Connect @revealui/ai to it
BITNET_BASE_URL=http://localhost:8080
```

The `@revealui/ai` package auto-detects `BITNET_BASE_URL` and routes agent calls to it. The same agent orchestration, memory system, and MCP integrations that work against Claude or GROQ work against BitNet — because BitNet exposes an OpenAI-compatible `/v1/chat/completions` endpoint.

No API key. No usage bill. No data leaving your machine.

### Hardware requirements

BitNet requires **AVX2** (standard on any x86-64 CPU made after 2013). It works on WSL2. It does not require AVX-512 or a GPU.

Reference hardware: Ryzen 7 5800U, 7.1 GB RAM — this is the development machine RevealUI is built on. BitNet runs comfortably on it with 6+ GB available for the rest of the stack.

## Nix: the environment that installs itself

The operational friction with BitNet is the build: it requires clang 18, cmake, ninja, and Python, and must be compiled from source. On most systems that means a manual dependency chain.

RevealUI uses Nix flakes + direnv. The entire development environment — Node, pnpm, Biome, and now clang 18 + all BitNet build dependencies — is declared in `flake.nix` and activated automatically when you enter the project directory.

```bash
# First time
git clone https://github.com/RevealUIStudio/revealui
cd RevealUI
direnv allow        # Nix builds and activates the full dev environment

# Build and download BitNet (all deps already provided by Nix)
pnpm bitnet:install

# Start the inference server
pnpm bitnet:serve
```

No `apt install`, no `brew install`, no conda environment. Every developer on the project gets the same clang 18 regardless of what's on their system. It works the same on a Ryzen laptop as it does on a Mac or a Linux CI runner.

The Nix guarantee matters here: if `pnpm bitnet:install` works on your machine, it works on every machine with Nix. That's a stronger guarantee than a README that says "install clang >= 18."

## Putting it together

Here's the full picture of what "local-first RevealUI" looks like in practice:

```
.envrc
└── revvault export-env revealui     # Decrypts secrets into environment

flake.nix
└── devShell
    ├── nodejs, pnpm, biome          # Standard RevealUI toolchain
    └── clang_18, cmake, ninja       # BitNet build deps (no manual install)

pnpm bitnet:install
└── git clone microsoft/BitNet       # Clones and compiles inference server
    huggingface-cli download         # Downloads bitnet-b1.58-2B-4T-gguf

pnpm bitnet:serve
└── run_inference_server.py          # Starts OpenAI-compatible server on :8080

BITNET_BASE_URL=http://localhost:8080
└── @revealui/ai                     # Agent orchestration routes to local model
    ├── planning, memory, CRDT       # Full agent stack
    └── @revealui/mcp                # MCP tool integrations
```

The entire AI-powered business stack — auth, content, products, payments, agents — running without a cloud API call in sight.

## Who this is for

The "local-first" configuration isn't the default. RevealUI works just as well with GROQ, Anthropic, or OpenAI as the inference backend. Cloud APIs are faster, require no local setup, and are the right choice when data residency and API costs aren't concerns.

But there's a real and growing audience for whom those concerns matter:

- **Bootstrapped developers** who can't absorb unpredictable LLM API costs as they scale
- **Agencies** building client software where the client's data can't transit third-party systems
- **Companies with data residency requirements** — healthcare, finance, legal, government
- **Developers in bandwidth-constrained environments** — offline-capable software, edge deployments
- **Anyone who has been burned by a provider sunset** — your inference doesn't disappear when a company pivots

For these cases, RevealUI with BitNet is the only full-stack agentic runtime option that doesn't require trusting a cloud provider with your most sensitive business data.

## What you don't give up

Running locally doesn't mean running poorly. The RevealUI agent stack has the same capabilities whether it's talking to Claude or BitNet:

- **Planning and tools** — agents can create todos, read and write files, execute shell commands
- **Memory** — episodic memory, working memory, CRDT-based persistence across sessions
- **MCP integrations** — Stripe, Supabase, Neon, Vercel, Playwright tool servers
- **Orchestration** — multi-agent coordination, sub-agent spawning, streaming

What you do give up: the raw capability of a 70B+ cloud model. BitNet 2B is excellent for structured tasks — code generation, data processing, form filling, API orchestration — but won't match a frontier model on open-ended reasoning. For most business automation use cases, that's an acceptable trade.

## Setup guide

See [Local-First Setup](/docs/LOCAL_FIRST) for the step-by-step guide: hardware requirements, Nix setup, BitNet installation, connecting `@revealui/ai`, and configuring RevVault.

---

*RevealUI is MIT licensed and available on [GitHub](https://github.com/RevealUIStudio/revealui). Get started with `npx create-revealui`.*
