# @revealui/ai

AI agents, open-model inference, CRDT memory, and the A2A protocol for RevealUI Pro.

## Overview

`@revealui/ai` provides a complete AI layer for your RevealUI application:

- **Agents** — long-running task agents with persistent state
- **Memory** — four-store cognitive memory (episodic, working, semantic, procedural)
- **Open-model inference** — Ubuntu snaps, BitNet, and open source models via the harness
- **Orchestration** — multi-agent coordination with the A2A protocol
- **MCP integration** — tool use via Model Context Protocol

## Installation

Requires a RevealUI Pro license. See the [Pro overview](/pro) for installation instructions.

```bash
pnpm add @revealui/ai
```

## Quick start

```typescript
import { createAgent } from '@revealui/ai'
import { createLLMClient } from '@revealui/ai/llm'

const llm = createLLMClient({
  provider: 'ollama',
  model: 'llama3.2:3b',
})

const agent = createAgent({
  name: 'my-agent',
  llm,
  tools: [],
})

const result = await agent.run('Summarize the latest blog posts.')
```

## Memory system

Agents use a four-store cognitive memory architecture:

| Store | Purpose | Persistence |
|-------|---------|-------------|
| `WorkingMemory` | Current context window | Session only |
| `EpisodicMemory` | Past interactions and events | Persistent (DB) |
| `SemanticMemory` | Knowledge and facts | Persistent (vector) |
| `ProceduralMemory` | Skills and procedures | Persistent (DB) |

```typescript
import { WorkingMemory, EpisodicMemory } from '@revealui/ai/memory'

const memory = {
  working: new WorkingMemory({ maxTokens: 4096 }),
  episodic: new EpisodicMemory({ db }),
}
```

## Inference Paths

| Path | Chat | Embeddings | Notes |
|------|------|-----------|-------|
| Ubuntu Inference Snaps | Yes | Depends on model | Canonical snap runtime — Gemma3, DeepSeek-R1, etc. |
| BitNet | Yes | No | 1-bit quantized, CPU-only, ~700 MB RAM |
| Ollama | Yes | Yes | Any open source GGUF model, local inference |
| HuggingFace | Yes | Yes | Open models via HuggingFace Inference API |
| Vultr | Yes | Depends on model | Open models on Vultr serverless GPU inference |

## A2A protocol

RevealUI implements the Google A2A (Agent-to-Agent) protocol for multi-agent coordination.

```typescript
import { A2AServer, A2AClient } from '@revealui/ai/a2a'

// Register an agent to accept tasks
const server = new A2AServer({ agent, port: 3010 })

// Send tasks to another agent
const client = new A2AClient({ endpoint: 'http://localhost:3010' })
const task = await client.sendTask({ message: 'Process this document.' })
```

## Open-Model Inference

All inference runs on open source models — no proprietary cloud APIs. See the [inference guide](/pro/inference) for setup details.

```typescript
import { createLLMClient } from '@revealui/ai/llm'

// Auto-detects from environment (snaps > BitNet > Ollama)
const llm = createLLMClient()
```
