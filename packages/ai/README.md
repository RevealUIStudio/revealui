# @revealui/ai

> **Commercial package**  -  requires a [RevealUI Pro license](https://revealui.com/pro). Free to install and evaluate; a license key is required for production use.


AI system for RevealUI - memory, LLM, orchestration, and tools.

## Features

- **Memory System**: CRDT-based persistent memory (Working, Episodic, Semantic)
- **LLM Integration**: Provider abstractions for Anthropic, GROQ, Ollama, Canonical Inference Snaps, and more
- **Agent Orchestration**: Runtime and execution engine for AI agents
- **Tool Calling**: Tool registry + standard-MCP-client integration (Stage 5.1a)
- **Vector Search**: Semantic search with pgvector
- **Type-safe**: Full TypeScript support
- **Performant**: Optimized for low-latency operations

## Reference stack (Ubuntu)

The recommended on-prem / on-device stack pairs `@revealui/ai` with a
**Canonical Inference Snap** for local LLM inference:

```
@revealui/ai (this package)
   │
   ├── agent runtime + tool-calling loop
   │
   ├── MCP client → @revealui/mcp/client → tools/resources/prompts from MCP servers
   │
   └── LLM provider → OpenAI-compatible HTTP → localhost:<port>/v1
                                                    ▲
                                                    │
                                         Canonical Inference Snap
                                         (DeepSeek R1, Qwen 2.5 VL,
                                          Gemma 3, Nemotron Nano —
                                          silicon-optimized on Intel/
                                          Ampere/NVIDIA/NPU)
```

Quick setup:

```bash
sudo snap install gemma3               # or deepseek-r1, qwen-vl, etc.
gemma3 set http.port=9090
gemma3 status                          # confirms base URL
```

```typescript
import { InferenceSnapsProvider, LLMClient } from '@revealui/ai'

const provider = new InferenceSnapsProvider({
  baseURL: 'http://localhost:9090/v1',
  model: 'gemma3',
})

const client = new LLMClient({ provider })
```

Cloud providers (Anthropic, OpenAI, GROQ) remain supported; the local
inference path is the documented default for self-hosted deployments.

## MCP tool integration

Standard MCP servers plug into the agent runtime as tool sources. Construct
an `McpClient` (from `@revealui/mcp/client`), connect it, and pass it to
`AgentRuntime`:

```typescript
import { McpClient } from '@revealui/mcp/client'
import { AgentRuntime } from '@revealui/ai'

const contentClient = new McpClient({
  clientInfo: { name: 'my-agent', version: '1.0.0' },
  transport: { kind: 'streamable-http', url: 'https://admin.example.com/api/mcp/content' },
})
await contentClient.connect()

const runtime = new AgentRuntime({
  mcpClients: [{ name: 'content', client: contentClient }],
})
```

Tools from each client are namespaced as `mcp_<name>__<toolName>` so multiple
clients coexist without collisions.

### Resources + prompts (Stage 5.1b)

When an MCP client advertises resources and/or prompts, the adapter
additionally emits per-server meta-tools so the agent can read them on
demand without any bespoke wiring:

| Meta-tool | Calls | Returns |
|---|---|---|
| `mcp_<ns>__list_resources` | `client.listResources()` | `[{ uri, name?, description?, mimeType? }, …]` |
| `mcp_<ns>__read_resource({ uri })` | `client.readResource(uri)` | resource contents; text parts flattened into the `content` field for token-efficient LLM context |
| `mcp_<ns>__list_prompts` | `client.listPrompts()` | `[{ name, description?, arguments? }, …]` |
| `mcp_<ns>__get_prompt({ name, args? })` | `client.getPrompt(name, args)` | `{ description?, messages }`; text messages flattened to `<role>: <text>` |

All four are opt-out via `include` on `createToolsFromMcpClient()`. Meta-tools
are silently skipped when the client doesn't implement the underlying
method (e.g. servers that don't advertise the resources capability).

```typescript
// Include every primitive (default)
const tools = await createToolsFromMcpClient(client, { namespace: 'content' })

// Tools only, skip the resources/prompts meta-tools
const toolsOnly = await createToolsFromMcpClient(client, {
  namespace: 'content',
  include: { tools: true, resources: false, prompts: false },
})
```

Stage 5.2 will add recursive sampling (server → agent's LLM provider);
Stage 5.3 surfaces elicitation + progress + cancellation in agent UI.

The legacy `mcpToolSource` path (hypervisor-backed) still works and is
kept for backwards compatibility, but new integrations should prefer the
`mcpClients` path.

## Installation

```bash
pnpm add @revealui/ai
```

## Quick Start

```typescript
import { EpisodicMemory } from '@revealui/ai/memory/stores'
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

- **[TESTING.md](./TESTING.md)**: Complete testing guide, limitations, and validation plan
- **[OBSERVABILITY.md](./OBSERVABILITY.md)**: Observability and monitoring guide
- **Source Code**: `packages/ai/src/memory/`
- **Helper Functions**: `packages/ai/src/memory/utils/sql-helpers.ts`

## API Reference

### Memory System

#### EpisodicMemory

Long-term memory for conversation history and agent memories.

```typescript
import { EpisodicMemory } from '@revealui/ai/memory/stores'

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

Provider abstractions and unified client for Anthropic, GROQ, and Ollama.

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

## Performance Considerations

The memory system uses deep cloning to ensure immutability and prevent data corruption. Understanding the cloning strategy is important for performance optimization.

### Cloning Layers

1. **LWWRegister Level** (Core CRDT)
   - `get()`: Clones object/array values on every call
   - `set()`: Clones values when storing
   - `merge()`: Clones winning values during merge
   - `toData()`: Clones values when serializing

2. **WorkingMemory Level**
   - `getContext()`: Returns cloned context from LWWRegister
   - `getContextValue()`: Returns value from cloned context (no additional cloning)
   - `setContext()`: Clones entire context object
   - `updateContext()`: Clones context once for multiple updates

3. **AgentContextManager Level**
   - `getContext()`: Returns value from cloned context (no additional cloning)
   - `getAllContext()`: Returns cloned context from WorkingMemory
   - `setContext()`: Validates then sets (cloning happens in WorkingMemory)
   - `updateContext()`: Validates then updates (cloning happens in WorkingMemory)

### Performance Implications

#### ✅ Efficient Operations

- **Single key access**: `getContext(key)` - No double cloning
- **Multiple updates**: `updateContext({ k1: v1, k2: v2 })` - Single clone
- **Primitive values**: No cloning overhead

#### ⚠️ Performance Considerations

- **Large contexts**: Every `getContext()` clones the entire context
- **Frequent updates**: Each update clones the context
- **Deep nesting**: Deep cloning is recursive and can be slow for very deep objects

### Best Practices

**1. Batch Updates**: Use `updateContext()` for multiple changes instead of multiple `setContext()` calls

```typescript
// ❌ Bad: Clones context 3 times
manager.setContext('key1', 'value1')
manager.setContext('key2', 'value2')
manager.setContext('key3', 'value3')

// ✅ Good: Clones context once
manager.updateContext({
  key1: 'value1',
  key2: 'value2',
  key3: 'value3',
})
```

**2. Cache Context**: If you need to access multiple values, get the full context once

```typescript
// ❌ Bad: Clones context multiple times
const value1 = manager.getContext('key1')
const value2 = manager.getContext('key2')
const value3 = manager.getContext('key3')

// ✅ Good: Clone once, access multiple times
const context = manager.getAllContext()
const value1 = context.key1
const value2 = context.key2
const value3 = context.key3
```

**3. Avoid Deep Nesting**: Keep context structure relatively flat

```typescript
// ❌ Bad: Very deep nesting
context: {
  user: {
    profile: {
      settings: {
        theme: {
          color: 'dark'
        }
      }
    }
  }
}

// ✅ Good: Flatter structure
context: {
  'user.profile.settings.theme.color': 'dark'
}
```

**4. Use Primitives When Possible**: Primitives don't require cloning

```typescript
// ✅ Good: Primitives are fast
manager.setContext('count', 42)
manager.setContext('name', 'John')

// ⚠️ Consider: Objects require cloning
manager.setContext('user', { name: 'John', age: 30 })
```

### Size Limits

The system enforces limits to prevent performance issues:

- **Max Context Keys**: 10,000 keys
- **Max Context Size**: ~10MB (approximate)
- **Max Object Depth**: 100 levels

These limits prevent:
- Memory exhaustion
- Stack overflow from deep recursion
- Performance degradation from huge objects

### Monitoring Performance

If you experience performance issues:

1. **Profile Context Size**: Check how large your contexts are
2. **Monitor Clone Operations**: Count how many times contexts are cloned
3. **Check Depth**: Ensure objects aren't too deeply nested
4. **Review Update Patterns**: Look for opportunities to batch updates

### Future Optimizations

Potential optimizations (not yet implemented):

- **Lazy Cloning**: Only clone when values are actually accessed
- **Structural Sharing**: Share unchanged parts of objects
- **Caching**: Cache cloned values for frequently accessed keys
- **Incremental Updates**: Only clone changed parts of context

## Requirements

- Node.js 18+
- PostgreSQL with pgvector extension
- Neon Postgres (for production) or compatible database

## License

Commercial  -  see [LICENSE.commercial](../../LICENSE.commercial)

---

**Last Updated**: 2026-03-04
**Consolidated**: 2026-01-31 (Merged PERFORMANCE.md into this README)
