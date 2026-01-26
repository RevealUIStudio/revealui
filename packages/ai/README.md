# @revealui/ai

AI system for RevealUI - memory, LLM, orchestration, and tools.

## Features

- **Memory System**: CRDT-based persistent memory (Working, Episodic, Semantic)
- **LLM Integration**: Provider abstractions for OpenAI, Anthropic, and more
- **Agent Orchestration**: Runtime and execution engine for AI agents
- **Tool Calling**: Tool registry and execution system
- **Vector Search**: Semantic search with pgvector
- **Type-safe**: Full TypeScript support
- **Performant**: Optimized for low-latency operations

## Installation

```bash
pnpm add @revealui/ai
```

## Quick Start

```typescript
import { EpisodicMemory } from '@revealui/ai/memory/memory'
import { NodeIdService } from '@revealui/ai/memory/services'
import { createClient } from '@revealui/db/client'

const db = createClient({ connectionString: process.env.POSTGRES_URL! })
const nodeIdService = new NodeIdService(db)
const nodeId = await nodeIdService.getNodeId('user', 'user-123')
const memory = new EpisodicMemory('user-123', nodeId, db)
```

## Testing

⚠️ **Important**: This package has known testing limitations. See [TESTING.md](./TESTING.md) for details.

### Quick Commands

```bash
# Unit tests (always work)
pnpm --filter @revealui/ai test

# Integration tests (require Neon instance)
POSTGRES_URL="postgresql://..." pnpm --filter @revealui/ai test __tests__/integration

# Production validation
POSTGRES_URL="postgresql://..." ./scripts/validate-production.sh
```

### Testing Limitations

- ❌ Local PostgreSQL testing not possible (Neon HTTP driver limitation)
- ⚠️ Mock database tests may fail (known limitation, not a bug)

**Full documentation**: See [TESTING.md](./TESTING.md)

## Documentation

- **[Performance Guide](../../docs/../packages/ai/PERFORMANCE.md)** - Performance analysis and optimization

- **[TESTING.md](./TESTING.md)**: Complete testing guide, limitations, and validation plan
- **Source Code**: `packages/ai/src/memory/`
- **Helper Functions**: `packages/ai/src/memory/utils/sql-helpers.ts`

## API Reference

### Memory System

#### EpisodicMemory

Long-term memory for conversation history and agent memories.

```typescript
import { EpisodicMemory } from '@revealui/ai/memory/memory'

const memory = new EpisodicMemory(userId, nodeId, db)
await memory.add(agentMemory)
await memory.save()
const memories = await memory.getAll()
```

#### NodeIdService

Deterministic node IDs for CRDT operations.

```typescript
import { NodeIdService } from '@revealui/ai/memory/services'

const nodeIdService = new NodeIdService(db)
const nodeId = await nodeIdService.getNodeId('user', 'user-123')
```

#### CRDTPersistence

Generic adapter for saving/loading CRDT state.

```typescript
import { CRDTPersistence } from '@revealui/ai/memory/persistence'

const persistence = new CRDTPersistence(db)
await persistence.saveCRDTState(crdtId, 'lww_register', data)
const state = await persistence.loadCRDTState(crdtId, 'lww_register')
```

### LLM Integration

Provider abstractions and unified client for OpenAI and Anthropic.

```typescript
import { LLMClient, createLLMClientFromEnv } from '@revealui/ai/llm/client'

const client = createLLMClientFromEnv()
const response = await client.chat([
  { role: 'user', content: 'Hello!' }
])
```

#### Vultr (Vultr AI / Serverless Inference)

You can configure the client to use Vultr Serverless Inference by setting `LLM_PROVIDER=vultr` and providing the `VULTR_API_KEY` and optionally `VULTR_BASE_URL` env vars. Example:

```
LLM_PROVIDER=vultr
VULTR_API_KEY=your_inference_api_key
VULTR_BASE_URL=https://api.vultrinference.com/v1  # optional
```

The `VultrProvider` supports the chat and (if available for the selected model) embeddings endpoints. Streaming is attempted via the chat streaming endpoint when supported by the API.

Demo: quick test script

You can run a quick demo script that exercises chat and embeddings endpoints. From the repository root:

```bash
# replace with real values
VULTR_API_KEY=your_key VULTR_MODEL=your-model-id ts-node packages/ai/scripts/test-vultr.ts
```

The script prints the raw API responses and a simplified assistant output.


### Agent Orchestration

Agent runtime and execution engine for autonomous agents.

```typescript
import { AgentRuntime } from '@revealui/ai/orchestration/runtime'
import { AgentOrchestrator } from '@revealui/ai/orchestration/orchestrator'

const runtime = new AgentRuntime()
const orchestrator = new AgentOrchestrator()
```

### Tools

Tool registry and execution system with MCP integration.

```typescript
import { ToolRegistry } from '@revealui/ai/tools/registry'
import { registerMCPTools } from '@revealui/ai/tools/mcp-adapter'

const registry = new ToolRegistry()
await registerMCPTools(mcpClient, registry)
```

## Requirements

- Node.js 18+
- PostgreSQL with pgvector extension
- Neon Postgres (for production) or compatible database

## License

MIT

---

**Last Updated**: 2025-01-27
