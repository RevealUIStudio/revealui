---
title: "@revealui/ai"
description: "AI agents, LLM providers, CRDT memory, and orchestration for RevealUI Pro"
category: package-guide
audience: developer
---

# @revealui/ai

AI agents, LLM providers, CRDT memory, and the A2A protocol for RevealUI Pro.

## Overview

`@revealui/ai` provides a complete AI layer for your RevealUI application:

- **Agents**  -  long-running task agents with persistent state
- **Memory**  -  four-store cognitive memory (episodic, working, semantic, procedural)
- **Open-model inference**  -  Ubuntu snaps, Ollama, and open source models via the harness
- **Streaming**  -  SSE-based token streaming via `StreamingAgentRuntime` and `useAgentStream`
- **Orchestration**  -  multi-agent coordination with the A2A protocol
- **MCP integration**  -  tool use via Model Context Protocol

## Installation

Requires a RevealUI Pro license. See the [Pro overview](/pro) for installation instructions.

```bash
pnpm add @revealui/ai
```

## Quick start

Install a model via Ubuntu Inference Snaps (recommended):

```bash
sudo snap install nemotron-3-nano   # general-purpose, low resource
# or: sudo snap install gemma3      # general + vision
```

```typescript
import { AgentRuntime } from "@revealui/ai/orchestration/runtime";
import { createLLMClientFromEnv } from "@revealui/ai/llm/client";
import type { Agent, Task } from "@revealui/ai/orchestration/agent";

// Auto-detects inference-snaps > Ollama from environment
const llm = createLLMClientFromEnv();

const agent: Agent = {
  id: "agent-1",
  name: "my-agent",
  instructions: "You summarize content concisely.",
  tools: [],
  getContext: () => ({ agentId: "agent-1" }),
};

const task: Task = { id: "task-1", description: "Summarize the latest blog posts." };

const runtime = new AgentRuntime({ maxIterations: 10 });
const result = await runtime.executeTask(agent, task, llm);
```

## Commercial model

AI features should be commercialized primarily through account-level entitlements plus metered agent execution, not only static tier flags or per-user license assumptions.

Recommended customer-facing billing units include:

- `agent_task`
- `workflow_run`
- `tool_call`
- `api_paid_call`

Per-user or perpetual licenses can still exist for narrow products, but hosted AI access should resolve from account or workspace entitlements.

## Memory system

Agents use a four-store cognitive memory architecture:

| Store              | Purpose                      | Persistence         |
| ------------------ | ---------------------------- | ------------------- |
| `WorkingMemory`    | Current context window       | Session only        |
| `EpisodicMemory`   | Past interactions and events | Persistent (DB)     |
| `SemanticMemory`   | Knowledge and facts          | Persistent (vector) |
| `ProceduralMemory` | Skills and procedures        | Persistent (DB)     |

```typescript
import { WorkingMemory, EpisodicMemory } from "@revealui/ai/memory/stores";

const memory = {
  working: new WorkingMemory({ maxTokens: 4096 }),
  episodic: new EpisodicMemory({ db }),
};
```

## Inference Paths

| Path | Chat | Embeddings | Notes |
| ---- | ---- | ---------- | ----- |
| **Ubuntu Inference Snaps** (recommended) | Yes | Depends on model | Canonical snap runtime  -  hardware-aware, single command install, OpenAI-compatible API |
| Ollama | Yes | Yes | Any open source GGUF model, local inference. Default chat: `gemma4:e2b`, embed: `nomic-embed-text` |

### Inference Snaps Models

| Snap | Type | Use Case |
| ---- | ---- | -------- |
| `nemotron-3-nano` | General (reasoning + non-reasoning) | **Free tier default**  -  lightweight, fast |
| `gemma3` | General + vision | Image understanding, multimodal tasks |
| `deepseek-r1` | Reasoning | Complex analysis, chain-of-thought |
| `qwen-vl` | Vision-language | Document parsing, visual Q&A |

Install: `sudo snap install <name>`. Each snap serves an OpenAI-compatible API at `http://localhost:<port>/v1`.

## A2A protocol

RevealUI implements the Google A2A (Agent-to-Agent) protocol for multi-agent coordination. The transport is plain JSON-RPC 2.0 over HTTP — register an agent card, mount `handleA2AJsonRpc` at your `/a2a` route, and let any A2A-compatible client POST to it:

```typescript
import { agentCardRegistry, handleA2AJsonRpc } from "@revealui/ai/a2a";

// Register an agent card (what this endpoint advertises)
agentCardRegistry.register({
  name: "my-agent",
  description: "Summarizes blog posts",
  url: "https://example.com/a2a",
  capabilities: { streaming: false, tools: [] },
});

// Mount the JSON-RPC handler in your route (Hono / Next.js / etc.)
app.post("/a2a", async (c) => {
  const body = await c.req.json();
  const response = await handleA2AJsonRpc(body, { agentName: "my-agent" });
  return c.json(response);
});
```

For task bookkeeping (store, cancel, append artifacts), use the task-store helpers:

```typescript
import { createTask, getTask, cancelTask, appendArtifact } from "@revealui/ai/a2a";
```

## Open-Model Inference

All inference runs on open source models  -  no proprietary cloud APIs, no vendor lock-in.

The recommended setup is **Ubuntu Inference Snaps**  -  Canonical's snap-packaged model serving with hardware-aware engine selection, signed packages, and zero configuration:

```bash
# Install your first model (free tier default)
sudo snap install nemotron-3-nano

# Check status
nemotron-3-nano status
```

```typescript
import { createLLMClientFromEnv } from "@revealui/ai/llm/client";

// Auto-detects from environment (snaps > Ollama)
const llm = createLLMClientFromEnv();
```

Auto-detection priority: `INFERENCE_SNAPS_BASE_URL` > `OLLAMA_BASE_URL`. See the [inference guide](/pro/inference) for full configuration details.

## Streaming

By default, `AgentRuntime.executeTask()` waits for the full LLM response before returning.
`StreamingAgentRuntime` extends this to yield typed `AgentStreamChunk` events as they arrive,
suitable for SSE delivery to the browser.

### StreamingAgentRuntime

```typescript
import { StreamingAgentRuntime } from "@revealui/ai/orchestration/streaming-runtime";
import type { AgentStreamChunk } from "@revealui/ai/orchestration/streaming-runtime";

const runtime = new StreamingAgentRuntime({ maxIterations: 10 });

for await (const chunk of runtime.streamTask(agent, task, llmClient)) {
  if (chunk.type === "text") process.stdout.write(chunk.content ?? "");
  if (chunk.type === "tool_call_start")
    console.log("calling", chunk.toolCall?.name);
  if (chunk.type === "done")
    console.log("finished in", chunk.metadata?.executionTime, "ms");
  if (chunk.type === "error") console.error(chunk.error);
}
```

**Chunk types:**

| Type               | Fields                                | Description                                             |
| ------------------ | ------------------------------------- | ------------------------------------------------------- |
| `text`             | `content`                             | Incremental token text                                  |
| `tool_call_start`  | `toolCall.name`, `toolCall.arguments` | Agent is about to call a tool                           |
| `tool_call_result` | `toolResult`                          | Tool execution result                                   |
| `error`            | `error`                               | Stream error or abort                                   |
| `done`             | `content`, `metadata.executionTime`   | Task complete; `content` is the full accumulated output |

**Abort support:** pass an `AbortSignal` as the fourth argument. On abort, a `{ type: 'error', error: 'interrupted' }` chunk is emitted and the generator stops.

```typescript
const controller = new AbortController();
const gen = runtime.streamTask(agent, task, llmClient, controller.signal);

// Cancel from UI
cancelButton.onclick = () => controller.abort();
```

**Deduplication:** identical tool calls within a single task run are automatically deduplicated  -  the second call returns the cached result without re-executing.

### `/api/agent-stream` SSE endpoint

The API exposes `POST /api/agent-stream` which returns a `text/event-stream` response.
Each `AgentStreamChunk` is serialised as one SSE event:

```
data: {"type":"text","content":"Here is"}
data: {"type":"text","content":" the answer"}
data: {"type":"done","content":"Here is the answer","metadata":{"executionTime":1234}}
```

**Request body:**

```typescript
{
  instruction: string     // Required
  boardId?: string        // Target board for ticket-based agents
  workspaceId?: string    // Workspace for RAG context
  priority?: 'low' | 'medium' | 'high' | 'critical'
}
```

Rate limited: 10 requests/minute. Requires the `ai` feature flag.

### `useAgentStream` React hook

Client-side hook for consuming the SSE stream. Uses `fetch + ReadableStream` (not `EventSource`,
which does not support POST).

```typescript
import { useAgentStream } from '@revealui/ai/client'

function AgentChat() {
  const { text, chunks, isStreaming, error, start, abort, reset } = useAgentStream()

  return (
    <>
      <button onClick={() => start({ instruction: 'Summarise open tickets' })}>
        Run
      </button>
      <button onClick={abort} disabled={!isStreaming}>
        Stop
      </button>
      <pre>{text}</pre>
      {error && <p className="text-red-500">{error}</p>}
    </>
  )
}
```

**State:**

| Field         | Type                 | Description                             |
| ------------- | -------------------- | --------------------------------------- |
| `text`        | `string`             | Accumulated text from all `text` chunks |
| `chunks`      | `AgentStreamChunk[]` | All received chunks in order            |
| `isStreaming` | `boolean`            | `true` while the stream is open         |
| `error`       | `string \| null`     | Last error message, if any              |

**Methods:**

| Method  | Signature                              | Description                                         |
| ------- | -------------------------------------- | --------------------------------------------------- |
| `start` | `(request, apiBase?) => Promise<void>` | Open the stream; cancels any in-flight stream first |
| `abort` | `() => void`                           | Cancel the current stream; `isStreaming` → `false`  |
| `reset` | `() => void`                           | Clear all state and cancel any stream               |

---

# Caching Strategies

RevealUI provides two application-level caching strategies that work with all supported inference paths (Ubuntu Inference Snaps, Ollama). These reduce inference costs and latency by avoiding redundant LLM calls.

## Overview

| Strategy | Savings | Hit Condition | Best For |
| -------- | ------- | ------------- | -------- |
| **Response Cache** | 100% on exact duplicates | Exact match (messages + params) | Duplicate queries, dev/testing |
| **Semantic Cache** | ~73% cost reduction | Vector similarity (≥0.95) | FAQ-style queries, similar questions |

Use both together for maximum savings: semantic cache catches similar queries (65% hit rate), response cache catches exact duplicates that semantic missed.

## Response Caching

**100% cost savings on duplicate requests** for any inference path.

Response caching stores complete LLM responses keyed by a SHA-256 hash of the input (messages, temperature, max tokens, tools, model). Identical requests within the TTL return the cached response instantly  -  no inference call.

### Enable

```bash
# In your .env file
LLM_ENABLE_RESPONSE_CACHE=true
```

### Use in Code

```typescript
import { createLLMClientFromEnv } from "@revealui/ai/llm/server";

const client = createLLMClientFromEnv();

// First request — calls inference, caches response
const response1 = await client.chat(messages);

// Identical request within 5 min — instant cache hit
const response2 = await client.chat(messages);

// Check cache stats
const stats = client.getResponseCacheStats();
console.log(`Hit rate: ${stats?.hitRate}%`);
```

### Configuration

```typescript
import { LLMClient } from "@revealui/ai/llm/client";

const client = new LLMClient({
  enableResponseCache: true,
  responseCacheOptions: {
    max: 1000, // Maximum cached responses
    ttl: 5 * 60 * 1000, // 5 minutes (default)
    enableStats: true, // Track hit/miss stats
  },
});
```

| Option        | Default       | Description                        |
| ------------- | ------------- | ---------------------------------- |
| `max`         | 1000          | Maximum number of cached responses |
| `ttl`         | 300000 (5min) | Time to live in milliseconds       |
| `enableStats` | true          | Track cache statistics             |

### Cache Key

The cache key is a SHA-256 hash of: messages (role + content), temperature, max tokens, tools, and model name. Same inputs produce the same key. LRU eviction removes least-recently-used entries when the cache is full.

### Monitoring

```typescript
const stats = client.getResponseCacheStats();

if (stats) {
  console.log(`Hits: ${stats.hits}`);
  console.log(`Misses: ${stats.misses}`);
  console.log(`Hit Rate: ${stats.hitRate}%`);
  console.log(`Cache Size: ${stats.size}`);
  console.log(`Evictions: ${stats.evictions}`);
}
```

---

## Semantic Caching

**~73% cost reduction** through meaning-based caching using vector embeddings.

Semantic caching uses embeddings to match queries by meaning, not just exact string equality. "How do I reset my password?" and "Password reset help" both hit the same cache entry.

### Enable

```bash
# In your .env file
LLM_ENABLE_SEMANTIC_CACHE=true

# Required: PostgreSQL with pgvector extension
POSTGRES_URL=postgresql://user:password@host:port/database
```

### Use in Code

```typescript
import { createLLMClientFromEnv } from "@revealui/ai/llm/server";

const client = createLLMClientFromEnv();

// First query — generates embedding, calls inference, caches response
const response1 = await client.chat([
  { role: "user", content: "How do I reset my password?" },
]);

// Similar query within 1 hour — instant cache hit (no inference call)
const response2 = await client.chat([
  { role: "user", content: "What's the process to reset my password?" },
]);

// Check cache stats
const stats = client.getSemanticCacheStats();
console.log(`Hit rate: ${stats?.hitRate}%`);
console.log(`Avg similarity: ${stats?.avgSimilarity}`);
```

### Configuration

```typescript
import { LLMClient } from "@revealui/ai/llm/client";

const client = new LLMClient({
  enableSemanticCache: true,
  semanticCacheOptions: {
    similarityThreshold: 0.95, // 95% similarity required (default)
    ttl: 60 * 60 * 1000, // 1 hour (default)
    enableStats: true, // Track statistics (default)
    userId: "user-123", // Multi-tenant filtering
    siteId: "site-456", // Multi-tenant filtering
  },
});
```

| Option                | Default       | Description                            |
| --------------------- | ------------- | -------------------------------------- |
| `similarityThreshold` | 0.95          | Minimum similarity for cache hit (0-1) |
| `ttl`                 | 3600000 (1hr) | Time to live in milliseconds           |
| `enableStats`         | true          | Track hit/miss statistics              |
| `userId`              | 'global'      | User ID for multi-tenant caching       |
| `siteId`              | 'global'      | Site ID for multi-tenant caching       |

### Similarity Threshold Guide

| Threshold | Hit Rate | Use Case |
| --------- | -------- | -------- |
| **0.99** | Low (~30%) | Nearly identical queries only |
| **0.95** | Medium (~65%) | Recommended default |
| **0.90** | High (~80%) | More flexible matching |
| **0.85** | Very high (~90%) | Risky  -  may match unrelated queries |

### Embedding Generation

Semantic caching uses Ollama's `nomic-embed-text` model for embeddings:

- **Dimensions**: 768
- **Cost**: Free (local inference)
- **Speed**: ~50ms average
- **Storage**: ~3 KB per cached entry embedding

Requires `OLLAMA_BASE_URL` to be set.

### Monitoring

```typescript
const stats = client.getSemanticCacheStats();

if (stats) {
  console.log(`Hits: ${stats.hits}`);
  console.log(`Misses: ${stats.misses}`);
  console.log(`Hit Rate: ${stats.hitRate}%`);
  console.log(`Avg Similarity: ${stats.avgSimilarity}`);
  console.log(`Total Queries: ${stats.totalQueries}`);
}
```

### Database Requirements

Semantic caching requires PostgreSQL with the pgvector extension (provided by Supabase in the dual-database architecture):

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Memories table (created by migrations) includes embedding column
```

---

## Best Practices

### Response Cache

- Enable for development and testing  -  massive savings on repeated prompts
- Enable for FAQ-style applications where exact duplicates are common
- Adjust TTL based on content freshness needs (5 minutes default)
- Monitor hit rates and adjust cache size if evictions are too frequent

### Semantic Cache

- Start with threshold 0.95 and adjust based on your use case
- Use multi-tenant filtering (`userId`/`siteId`) for SaaS applications
- Warm the cache on startup with common queries for immediate hits
- Do not set threshold below 0.90  -  risks returning wrong responses

### Both Together

Enable both caches for layered savings:

1. Semantic cache catches similar questions (65% hit rate)
2. Response cache catches exact duplicates that semantic missed
3. Combined: ~73% cost reduction with near-zero false matches

```bash
LLM_ENABLE_RESPONSE_CACHE=true
LLM_ENABLE_SEMANTIC_CACHE=true
```

---

**Status**: Fully tested
**Inference paths**: All (Ubuntu Inference Snaps, Ollama)
