# Open-Model Inference

RevealUI AI runs exclusively on open source models. No proprietary cloud APIs, no vendor lock-in, no API bills.

## Supported Inference Paths

| Path | Runtime | Cost | Use Case |
|------|---------|------|----------|
| **Ubuntu Inference Snaps** | Canonical snap runtime | Free (your hardware) | Production — Gemma3, DeepSeek-R1, Qwen-VL, Nemotron-Nano |
| **BitNet** | Microsoft llama-server | Free (CPU-only, ~700 MB RAM) | Air-gapped / low-resource — 1-bit quantized models |
| **Ollama** | Local GGUF models | Free (your hardware) | Flexible — any open source GGUF model |
| **HuggingFace** | HuggingFace Inference API | API usage costs | Open models hosted on HuggingFace infrastructure |
| **Vultr** | Vultr GPU Cloud | API usage costs | Open models on Vultr serverless inference |

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

## HuggingFace

Open models via the HuggingFace Inference API.

Configure:

```bash
HUGGINGFACE_API_KEY=hf_xxxxx
```

## Vultr GPU Cloud

Open models on Vultr serverless GPU inference.

Configure:

```bash
VULTR_API_KEY=VXUUC6WSXXXXXXXXXXXXXXXXXXXXXXXXXX
VULTR_BASE_URL=https://api.vultrinference.com/v1
```

## Auto-Detection

The LLM client factory auto-detects your inference path in this order:

1. `LLM_PROVIDER` (explicit override)
2. `INFERENCE_SNAPS_BASE_URL`
3. `BITNET_BASE_URL`
4. `OLLAMA_BASE_URL`
5. `HUGGINGFACE_API_KEY`
6. `VULTR_API_KEY`

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

- Local providers (snaps, BitNet, Ollama): no API keys leave your infrastructure
- Cloud providers (HuggingFace, Vultr): data is sent to your chosen cloud endpoint, but only open models are used — no proprietary APIs
- Full air-gap capability with BitNet (zero network required)
- Inference snaps are signed and verified by Canonical
