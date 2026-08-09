---
visibility: public
---

# @revealui/ai

AI agents, open-model inference, CRDT memory, and the A2A protocol — distributed under **Fair Source (FSL-1.1-MIT)**, source-visible in the public repo, with runtime feature gates that require a Pro / Enterprise subscription or a perpetual license. Each release converts to plain MIT after 2 years.

## Overview

`@revealui/ai` provides a complete AI layer for your RevealUI application:

- **Agents**  -  long-running task agents with persistent state
- **Memory**  -  four-store cognitive memory (working, episodic, semantic, procedural)
- **Open-model inference (default)**  -  Ollama, Canonical's Ubuntu Inference Snaps. Groq, Anthropic, OpenAI, and HuggingFace are pluggable, opt-in cloud adapters. Each one is a thin wrapper that calls the vendor's OpenAI-compatible HTTP endpoint using your own API key. RevealUI never hosts a model and ships no proprietary vendor SDK.
- **Orchestration**  -  multi-agent coordination with the A2A protocol
- **MCP integration**  -  tool use via Model Context Protocol (`@revealui/mcp`, MIT)

## Installation

The package is Fair Source — install it from npm like any other package; runtime feature gates verify your Pro license. See the [Pro overview](/docs/PRO) for license setup.

```bash
pnpm add @revealui/ai
```

## Quick start

Run a local model with Ollama (default path) or install a Canonical Inference Snap (planned recommended path; Studio lifecycle is not yet shipped, so you install + run the snap yourself):

```bash
# Default path
ollama pull qwen2.5:3b
ollama pull nomic-embed-text

# OR planned path (run + manage the snap yourself for now)
sudo snap install nemotron-3-nano
```

```typescript
import { createLLMClientFromEnv } from '@revealui/ai/llm/client'

// Auto-detects from environment: explicit LLM_PROVIDER first, then
// INFERENCE_SNAPS_BASE_URL, then GROQ_API_KEY, then OLLAMA_BASE_URL,
// then ANTHROPIC_API_KEY, then OPENAI_API_KEY, falling back to
// Inference Snaps if none are set. HuggingFace works too, but it is
// not part of this auto-detect list. Set LLM_PROVIDER=huggingface
// explicitly to use it.
const llm = createLLMClientFromEnv()

// Use the client directly
const response = await llm.chat([
  { role: 'user', content: 'Summarize the latest blog posts.' },
])

// Higher-level agent specs are defined via createAgentSpec; see
// packages/ai/src/templates/agent-spec.ts and the integration tests under
// packages/ai/src/__tests__/integration/ for current end-to-end patterns.
```

## Memory system

Agents use a four-store cognitive memory architecture:

| Store | Purpose | Persistence |
|-------|---------|-------------|
| `WorkingMemory` | Current context window | Session only |
| `EpisodicMemory` | Past interactions and events | Persistent (DB) |
| `SemanticMemory` | Knowledge and facts | Persistent (vector, NeonDB pgvector by default) |
| `ProceduralMemory` | Skills and procedures | Persistent (DB) |

See `@revealui/ai/memory` for the store classes (`WorkingMemory`, `EpisodicMemory`, `SemanticMemory`, `ProceduralMemory`) and the `agentMemories` table re-exported from `@revealui/db/schema/vector`.

## Inference Paths

| Path | Chat | Embeddings | Notes |
|------|------|-----------|-------|
| **Ollama** (default local) | Yes | Yes | Any open source GGUF model (Gemma 4, Qwen, Mistral). `nomic-embed-text` is the default 768-dim embedding model. |
| Ubuntu Inference Snaps (planned recommended) | Yes | Depends on snap | Canonical snap runtime — hardware-aware, single command install. Studio lifecycle pending. |
| Groq | Yes | No | Cloud, bring your own key. Opt-in via `GROQ_API_KEY`. |
| Anthropic | Yes | No | Cloud, bring your own key. Opt-in via `ANTHROPIC_API_KEY`. Calls Anthropic's OpenAI-compatible endpoint directly. No proprietary Anthropic SDK. |
| OpenAI | Yes | Yes | Cloud, bring your own key. Opt-in via `OPENAI_API_KEY`. |
| HuggingFace | Yes | Depends on model | Cloud, bring your own key. Set `HF_TOKEN` and `HF_MODEL_URL`, then select it explicitly with `LLM_PROVIDER=huggingface` (not part of auto-detect). Calls the HuggingFace OpenAI-compatible inference endpoint. |

## A2A protocol

RevealUI implements the [A2A (Agent-to-Agent) protocol](https://a2a.dev) for multi-agent coordination via `@revealui/ai/a2a`.

```typescript
// See packages/ai/src/a2a/{card,handler,task-store}.ts for the current API
// surface. The server side ships at apps/server/src/routes/a2a.ts.
```

## Inference defaults

Open-model inference is the default and recommended path — proprietary cloud APIs are pluggable but opt-in. The recommended local backends are **Ollama today** and **Ubuntu Inference Snaps from Canonical (planned)**.

See the [inference guide](/pro/inference) for full setup and all providers.
