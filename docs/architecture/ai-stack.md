# WSL AI Stack Roadmap

Three phases from zero-cost remote inference today to fully sovereign local GPU inference.

## Phase 1 — Zero Cost, Remote (current)

| Item | Value |
|------|-------|
| Provider | Groq free tier |
| Chat models | `llama-3.3-70b-versatile` (best quality), `llama-3.1-8b-instant` (fast/cheap) |
| Embeddings | HuggingFace free API (`sentence-transformers/all-MiniLM-L6-v2`) |
| Setup | `GROQ_API_KEY` env var, no local install required |
| Free limits | 6,000 TPM / 500,000 TPD for Llama 3.3 70B — sufficient for dev/testing |
| Status | Implemented |

```env
GROQ_API_KEY=gsk_...
LLM_PROVIDER=groq
# LLM_MODEL=llama-3.1-8b-instant  # override for faster/cheaper
```

## Phase 2 — Local Inference, CPU (3-6 months)

| Item | Value |
|------|-------|
| Provider | Ollama on WSL2 |
| Chat models | `phi4:14b` (9 GB, excellent coding) or `qwen2.5-coder:7b` (4.7 GB, best-in-class code gen) |
| Embed model | `nomic-embed-text` (274M params, ~600 MB, negligible RAM) |
| Setup | `ollama serve` as a systemd service in WSL2 |
| Benefits | Fully offline, no rate limits, no API costs |
| Prerequisite | ~16 GB RAM (for 14B model with headroom) |

```env
OLLAMA_BASE_URL=http://localhost:11434/v1
LLM_PROVIDER=ollama
LLM_MODEL=llama3.2:3b  # or phi4:14b when RAM allows
```

Quick start:
```bash
ollama pull llama3.2:3b
ollama pull nomic-embed-text
ollama serve
```

## Phase 3 — GPU-Accelerated Local (future)

| Item | Value |
|------|-------|
| Provider | Ollama with CUDA passthrough (WSL2 NVIDIA GPU support) |
| Chat models | `qwen2.5-coder:32b` or `deepseek-coder-v2:16b` |
| Embed model | `nomic-embed-text-v1.5` (SOTA open-source embeddings) |
| Setup | NVIDIA drivers + CUDA toolkit, WSL2 GPU passthrough |
| Benefits | ~20-40 tok/s on RTX 3080+, comparable to hosted APIs |
| Prerequisite | NVIDIA GPU with CUDA support in WSL2 |

## Provider Selection (env var driven)

```
LLM_PROVIDER=groq      → remote Groq API (Phase 1, free tier)
LLM_PROVIDER=ollama    → local Ollama (Phase 2/3)
LLM_PROVIDER=openai    → OpenAI or any OpenAI-compatible endpoint via OPENAI_BASE_URL
LLM_PROVIDER=anthropic → Anthropic (Claude models)
```

When `LLM_PROVIDER` is not set, `createLLMClientFromEnv()` auto-detects in this priority order:

1. `ANTHROPIC_API_KEY` → `anthropic`
2. `OPENAI_API_KEY` → `openai`
3. `GROQ_API_KEY` → `groq`
4. `OLLAMA_BASE_URL` → `ollama`

## Embeddings Strategy (separate from chat)

| Phase | Provider | Notes |
|-------|----------|-------|
| Phase 1 | HuggingFace free API | BERT/MiniLM models, requires `HF_TOKEN` |
| Phase 2+ | Ollama `nomic-embed-text` | Local, fast, free |
| Fallback | OpenAI `text-embedding-3-small` | If `OPENAI_API_KEY` is set |

> Groq does **not** support embeddings. If `LLM_PROVIDER=groq`, a separate embeddings
> provider must be configured for vector search features.

## Implementation Notes

- All providers are in `packages/ai/src/llm/providers/`
- `GroqProvider` and `OllamaProvider` wrap `OpenAIProvider` (both use the OpenAI-compatible API)
- Provider selection is handled by `createLLMClientFromEnv()` in `packages/ai/src/llm/client.ts`
- The agent dispatcher (`apps/api/src/routes/agent-tasks.ts`) delegates entirely to `createLLMClientFromEnv()`
