# @revealui/ai

AI agents, LLM providers, CRDT memory, and the A2A protocol for RevealUI Pro.

## Overview

`@revealui/ai` provides a complete AI layer for your RevealUI application:

- **Agents** — long-running task agents with persistent state
- **Memory** — four-store cognitive memory (episodic, working, semantic, procedural)
- **LLM providers** — GROQ, Ollama, and BYOK support
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
  provider: 'groq',
  apiKey: process.env.GROQ_API_KEY,
  model: 'llama-3.3-70b-versatile',
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

## LLM providers

| Provider | Chat | Embeddings | Notes |
|----------|------|-----------|-------|
| GROQ | Yes | No | Fast inference |
| Ollama | Yes | Yes | Local, no API key needed |
| BYOK | Yes | Depends | User-supplied key via `@revealui/ai/byok` |

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

## BYOK (Bring Your Own Key)

Users can supply their own LLM API keys, stored encrypted in the database.

```typescript
import { createLLMClientForUser } from '@revealui/ai/byok'

const llm = await createLLMClientForUser(userId, db)
// Uses the user's stored key; falls back to server key if none configured
```

See the [BYOK guide](/pro/byok) for full configuration details.
