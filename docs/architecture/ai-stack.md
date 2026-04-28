# AI Stack Architecture

RevealUI's AI subsystem lives in `@revealui/ai` (Pro, Fair Source FSL-1.1-MIT). It provides open-model inference, agent orchestration, CRDT-based memory, RAG ingestion, and streaming runtime  -  all gated by tier. The default and recommended path is open-model inference (Ollama, Canonical Inference Snaps); cloud-compatible providers (Groq, HuggingFace, OpenAI-compatible, Anthropic for prompt caching) are pluggable but opt-in via environment variables.

## Inference Abstraction

All LLM access flows through `LLMClient`, a factory that wraps inference backends behind a uniform interface (`chat()`, `stream()`, `embed()`).

### Supported Inference Paths

| Path | Chat | Embeddings | Key Env Var | Notes |
|------|------|-----------|-------------|-------|
| **Ubuntu Inference Snaps** | yes | depends on model | `INFERENCE_SNAPS_BASE_URL` | Canonical snap runtime  -  Gemma3, DeepSeek-R1, Qwen-VL, Nemotron-Nano |
| **Ollama** | yes | yes | `OLLAMA_BASE_URL` | Any open source GGUF model. Chat: `gemma4:e2b`, Embed: `nomic-embed-text` |

### Auto-Detection Priority

`createLLMClientFromEnv()` selects the inference path by checking env vars in order:

1. `LLM_PROVIDER` (explicit override)
2. `INFERENCE_SNAPS_BASE_URL`
3. `OLLAMA_BASE_URL`

## Tier Model

Revenue tiers control AI access via runtime feature gating:

> **Pricing source.** Tier pricing is defined in [`packages/contracts/src/pricing.ts`](https://github.com/RevealUIStudio/revealui/blob/main/packages/contracts/src/pricing.ts) and exposed at runtime via `GET /api/pricing` (which falls back to Stripe Products API in production). Treat the linked file as the source of truth; the table below is a snapshot.

| Tier | AI Access | Task Quota | Coding Tools | Inference |
|------|-----------|-----------|--------------|-----------|
| **Free** | Local only (Ollama / snaps) | 1,000/mo | Read-only | `INFERENCE_SNAPS_BASE_URL` or `OLLAMA_BASE_URL` |
| **Pro** | Local + cloud harness | 10,000/mo | Full | Snaps, Ollama, RevealUI cloud |
| **Max** | Local + cloud + advanced config | 50,000/mo | Full + memory | Snaps, Ollama, RevealUI cloud |
| **Forge (Enterprise)** | Unlimited | Metered | Full + memory + multi-tenant | All open models |

### Access Modes

The `aiAccessMode` field on entitlements controls enforcement:

- **`local`**: Free tier uses inference snaps or Ollama. No API key needed. Read-only coding tools (`file_read`, `file_glob`, `file_grep`, `project_context`).

### Quota Enforcement

Task quota middleware (`apps/api/src/middleware/task-quota.ts`) runs on every agent request:

1. Read current month's usage from `agent_task_usage` table
2. If under quota, allow and increment atomically
3. If over quota, check `agent_credit_balance` for prepaid credits
4. If no credits and `X402_ENABLED=true`, return HTTP 402 for USDC payment
5. Otherwise return 429 with upgrade prompt

## Agent Orchestration

### Runtime

`AgentRuntime` (`packages/ai/src/orchestration/runtime.ts`) executes a tool-calling loop:

1. Format system prompt + user task into messages
2. Call LLM with tool definitions
3. Parse and execute tool calls (with deduplication)
4. Append tool results to message history
5. Iterate until `done` or max iterations (default: 10, timeout: 60s)

Supports: MCP tool discovery, skill injection, extended thinking, prompt caching, tool result compression per model tier.

### Streaming

`StreamingAgentRuntime` extends the runtime with async generator output:

```
AgentStreamChunk types: text | tool_call_start | tool_call_result | error | done
```

The `/api/agent-stream` POST route serves SSE responses. The React hook `useAgentStream` consumes them client-side.

### Tool Categories

- **admin tools**: Content CRUD, media management, user/globals operations
- **Coding tools** (Pro+): `file_read`, `file_write`, `file_edit`, `file_glob`, `file_grep`, `shell_exec`, `git_ops`, `project_context`
- **Coding tools** (free tier): Read-only subset only (`file_read`, `file_glob`, `file_grep`, `project_context`)
- **Memory tools**: Episodic recall, working memory access
- **Web tools**: DuckDuckGo search (default)
- **MCP adapter**: External tool discovery via MCP protocol

## Memory System

CRDT-based distributed memory with four stores:

| Store | Scope | Persistence | Use Case |
|-------|-------|-------------|----------|
| **Working** | Session | Volatile | Current conversation context |
| **Episodic** | Long-term | PostgreSQL + pgvector | Task history, vector-searchable |
| **Semantic** | Long-term | PostgreSQL + pgvector | Knowledge base (BM25 + vector hybrid) |
| **Procedural** | Long-term | PostgreSQL | Agent skills and techniques |

### CRDT Primitives

- **LWWRegister**: Last-Writer-Wins for single values (preferences, configs)
- **ORSet**: Observed-Remove Set for collections
- **PNCounter**: Distributed increment/decrement counter
- **VectorClock**: Causal ordering across nodes

Memory integration is optional  -  agents degrade gracefully without it. Requires Max tier (`aiMemory` feature flag).

## RAG Pipeline

`packages/ai/src/ingestion/` provides document indexing and retrieval:

- **Text splitter**: Chunk documents for embedding
- **File parsers**: Extract text from various formats
- **Hybrid search**: BM25 (keyword) + vector (semantic) with reranking
- **admin indexer**: Auto-indexes admin content for agent context

Embeddings stored in Supabase (pgvector). Search queries use the dual-database pattern: NeonDB for metadata, Supabase for vectors.

## Caching Layers

Two caching strategies reduce LLM costs:

- **Response cache**: Exact-match deduplication (100% savings on duplicate prompts)
- **Semantic cache**: Embedding similarity matching (73% cost reduction on near-duplicate prompts)

Both are opt-in via `LLMClientConfig.enableResponseCache` and `enableSemanticCache`.

## Package Structure

`@revealui/ai` exports 18 subpaths for granular imports:

```
@revealui/ai                    Main entry + licensing
@revealui/ai/memory             Memory system
@revealui/ai/memory/stores      Working, Episodic, Semantic, Procedural
@revealui/ai/memory/vector      Vector search
@revealui/ai/memory/persistence CRDT persistence
@revealui/ai/memory/agent       Agent context manager
@revealui/ai/embeddings         Embedding generation
@revealui/ai/client             React hooks (useAgentStream, etc.)
@revealui/ai/skills             Agent skill definitions
@revealui/ai/llm/client         LLMClient factory
@revealui/ai/llm/providers/base Provider interface
@revealui/ai/tools/admin          admin tool integration
@revealui/ai/tools/registry     Tool registry
@revealui/ai/ingestion          RAG pipeline
@revealui/ai/orchestration/*    Agent runtime, streaming, memory integration
@revealui/ai/inference           Context assembly, budget, compression
```

## Feature Flag Reference

```
aiLocal:         free     Local inference (snaps / Ollama)
ai:              pro      AI agents (local + cloud via RevealUI harness)
mcp:             pro      MCP framework integration
aiMemory:        max      Working + episodic memory
aiInference:     max      Open-model inference configuration (snaps, harness)
```

## Environment Variables

| Variable | Required | Description |
|----------|---------|-------------|
| `INFERENCE_SNAPS_BASE_URL` | No | Ubuntu inference snap URL |
| `OLLAMA_BASE_URL` | No | Ollama server URL (default: `http://localhost:11434/v1`) |
| `LLM_PROVIDER` | No | Force specific inference path (overrides auto-detection) |
| `LLM_MODEL` | No | Override default model for the selected inference path |
| `X402_ENABLED` | No | Enable USDC payment fallback when quota exceeded |
