# The Air-Gap Capable Business Stack

*By Joshua Vaughn  -  RevealUI Studio*

---

Most software companies accept a particular bargain without thinking about it: your secrets live in someone else's vault, your AI calls someone else's API, and your dev environment is a pile of global installs that one `npm install -g` can break.

RevealUI doesn't accept that bargain.

This post is about a different way to run a software business  -  one where your secrets are encrypted on your own machine, your AI inference runs on your CPU, and your development environment is fully reproducible. Not because you're paranoid, but because owning your stack is simply better engineering.

## The four layers

RevealUI's local-first story comes from four independent pieces that happen to compose cleanly:

| Layer | Technology | What it does |
|-------|-----------|-------------|
| **Secrets** | RevVault (age encryption) | Credentials stay on your machine, encrypted at rest |
| **AI inference (default)** | Inference snaps / Ollama (open models) | Local LLM inference. Cloud-compatible providers (Groq, Vultr, HuggingFace, OpenAI-compatible, Anthropic) are pluggable via env vars but opt-in. |
| **Dev environment** | Nix flakes + direnv | Reproducible environment, zero manual tool installs |
| **Business logic** | RevealUI Pro | Auth, content, payments, AI agents  -  all wired |

Each layer independently solves a real problem. Together, they give you something genuinely unusual: a full AI-powered business software stack that can run without a network connection.

## RevVault: secrets that don't travel

RevealUI uses [RevVault](https://github.com/RevealUIStudio/revvault) for credential management. RevVault is an age-encrypted local secret store  -  a Git-friendly vault that keeps secrets on your filesystem, encrypted, and never phones home.

```bash
# Store a secret
revvault set my-project/stripe/secret-key

# Retrieve it
revvault get my-project/stripe/secret-key

# Load into environment (used by .envrc)
revvault export-env my-project > .env.local
```

The practical upside: your `.env` never touches Vercel's secret storage, your CI system, or any third-party dashboard unless you put it there explicitly. The `.envrc` in every RevealUI project calls `revvault export-env` at shell entry  -  credentials are decrypted on the fly, used in memory, never written to disk in plaintext.

Contrast this with the standard pattern: secrets in Vercel, AWS Secrets Manager, or a `.env` file checked into a private repo. All three involve trusting a third party with values that should only exist on hardware you control.

## Local inference: your models, your hardware

RevealUI's AI agents run on open source models locally. The recommended path is **Ubuntu Inference Snaps**  -  Canonical's snap-packaged model serving with hardware-aware engine selection, signed packages, and zero configuration:

```bash
# Install a model (one command)
sudo snap install nemotron-nano

# Check status
nemotron-nano status
```

Each snap serves an OpenAI-compatible API locally. The `@revealui/ai` package auto-detects the running snap and routes agent calls to it. The same agent orchestration, memory system, and MCP integrations work with any supported inference path  -  because they all expose OpenAI-compatible `/v1/chat/completions` endpoints.

As a fallback, **Ollama** supports any open source GGUF model (default: `gemma4:e2b`):

```bash
ollama serve &
ollama pull gemma4:e2b
```

No API key. No usage bill. No data leaving your machine.

## Nix: the environment that installs itself

RevealUI uses Nix flakes + direnv. The entire development environment  -  Node, pnpm, Biome, and all build dependencies  -  is declared in `flake.nix` and activated automatically when you enter the project directory.

```bash
# First time
git clone https://github.com/RevealUIStudio/revealui
cd RevealUI
direnv allow        # Nix builds and activates the full dev environment

# Install a model via inference snaps (recommended)
sudo snap install nemotron-nano

# Or use Ollama
ollama pull gemma4:e2b
```

No `apt install`, no `brew install`, no conda environment. Every developer on the project gets the same toolchain regardless of what's on their system. It works the same on a Ryzen laptop as it does on a Mac or a Linux CI runner.

## Putting it together

Here's the full picture of what "local-first RevealUI" looks like in practice:

```
.envrc
└── revvault export-env revealui     # Decrypts secrets into environment

flake.nix
└── devShell
    └── nodejs, pnpm, biome          # Standard RevealUI toolchain

sudo snap install nemotron-nano    # Or: ollama pull gemma4:e2b
└── OpenAI-compatible API served locally

@revealui/ai                         # Agent orchestration routes to local model
├── planning, memory, CRDT           # Full agent stack
└── @revealui/mcp                    # MCP tool integrations
```

The entire AI-powered business stack  -  auth, content, products, payments, agents  -  running without a cloud API call in sight.

## Who this is for

The "local-first" configuration is one of several inference paths. RevealUI supports Ubuntu Inference Snaps (Canonical's managed runtime, planned recommended) and Ollama (any open source GGUF model, default local). Cloud-compatible providers — Groq, Vultr, HuggingFace, OpenAI-compatible endpoints, and Anthropic for prompt caching — are pluggable but opt-in via env vars. Pick the path that fits your trust + cost profile; there is no vendor lock-in.

But there's a real and growing audience for whom those concerns matter:

- **Bootstrapped developers** who can't absorb unpredictable LLM API costs as they scale
- **Agencies** building client software where the client's data can't transit third-party systems
- **Companies with data residency requirements**  -  healthcare, finance, legal, government
- **Developers in bandwidth-constrained environments**  -  offline-capable software, edge deployments
- **Anyone who has been burned by a provider sunset**  -  your inference doesn't disappear when a company pivots

For these cases, RevealUI with local inference is the only full-stack agentic runtime option that doesn't require trusting a cloud provider with your most sensitive business data.

## What you don't give up

Running locally doesn't mean running poorly. The RevealUI agent stack has the same capabilities whether it's talking to a cloud model or a local Gemma 4 instance:

- **Planning and tools**  -  agents can create todos, read and write files, execute shell commands
- **Memory**  -  episodic memory, working memory, CRDT-based persistence across sessions
- **MCP integrations**  -  12 first-party tool servers (Stripe, Supabase, Neon, Vercel, Playwright, Code Validator, Next.js DevTools, plus RevealUI-internal Content / Email / Memory / Stripe servers, and the adapter base class)
- **Orchestration**  -  multi-agent coordination, sub-agent spawning, streaming

What you do give up: the raw capability of a 70B+ cloud model. Smaller local models like Gemma 4 are excellent for structured tasks  -  code generation, data processing, form filling, API orchestration  -  but won't match a frontier model on open-ended reasoning. For most business automation use cases, that's an acceptable trade.

## Setup guide

See [Local-First Setup](/local-first) for the step-by-step guide: hardware requirements, Nix setup, inference snaps / Ollama installation, connecting `@revealui/ai`, and configuring RevVault.

---

*RevealUI is MIT licensed and available on [GitHub](https://github.com/RevealUIStudio/revealui). Get started with `npx create-revealui`.*
