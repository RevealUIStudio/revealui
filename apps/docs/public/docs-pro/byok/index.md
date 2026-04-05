# Open-Model Inference

RevealUI AI runs exclusively on open source models. No proprietary cloud APIs, no vendor lock-in, no API bills.

## Supported Inference Paths

| Path | Runtime | Cost | Use Case |
|------|---------|------|----------|
| **Ubuntu Inference Snaps** | Canonical snap runtime | Free (your hardware) | Production — Gemma3, DeepSeek-R1, Qwen-VL, Nemotron-Nano |
| **BitNet** | Microsoft llama-server | Free (CPU-only, ~700 MB RAM) | Air-gapped / low-resource — 1-bit quantized models |
| **Open Source via Harness** | RevealUI harness + Ollama | Free (your hardware) | Flexible — any GGUF or HuggingFace model |

## Ubuntu Inference Snaps

Canonical's snap-based model serving. Install a model, get an OpenAI-compatible endpoint.

```bash
sudo snap install gemma3
```

Configure in your environment:

```bash
INFERENCE_SNAPS_BASE_URL=http://localhost:8080/v1
```

Available models: Gemma3, DeepSeek-R1, Qwen-VL, Nemotron-Nano.

## BitNet

1-bit quantized models that run on CPU with minimal RAM. Ideal for air-gapped deployments.

```bash
pnpm bitnet:install   # Clone + compile + download model
pnpm bitnet:serve     # Start inference server on :8080
```

Configure:

```bash
BITNET_BASE_URL=http://localhost:8080/v1
```

## Ollama (Open Source Models)

Run any open source model locally via the RevealUI harness.

```bash
ollama pull llama3.2:3b           # Chat model
ollama pull nomic-embed-text      # Embedding model
```

Configure:

```bash
OLLAMA_BASE_URL=http://localhost:11434/v1
```

## Auto-Detection

The LLM client factory auto-detects your inference path in this order:

1. `LLM_PROVIDER` (explicit override)
2. `INFERENCE_SNAPS_BASE_URL`
3. `BITNET_BASE_URL`
4. `OLLAMA_BASE_URL`

When both BitNet and Ollama are configured, chat routes to BitNet and embeddings route to Ollama automatically.

## Server-side Usage

```typescript
import { createLLMClient } from '@revealui/ai/llm'

// Auto-detects from environment
const llm = createLLMClient()

const response = await llm.chat([
  { role: 'user', content: 'Hello!' },
])
```

## Security

- No API keys leave your infrastructure
- Models run on your hardware — data never reaches external servers
- Full air-gap capability with BitNet (zero network required)
- Inference snaps are signed and verified by Canonical
