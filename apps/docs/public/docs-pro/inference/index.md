# Open-Model Inference

RevealUI AI runs exclusively on open source models. No proprietary cloud APIs, no vendor lock-in, no API bills.

## Recommended: Ubuntu Inference Snaps

**Inference Snaps** from Canonical are the recommended way to run local AI with RevealUI. One command installs a pre-optimized model with hardware-aware engine selection, signed packages, and an OpenAI-compatible API.

```bash
# Install the free tier default model
sudo snap install nemotron-3-nano

# Check status and endpoint
nemotron-3-nano status

# Optional: change the HTTP port (default varies by snap)
nemotron-3-nano set http.port=9090
```

The snap serves an OpenAI-compatible API at `http://localhost:<port>/v1`  -  the RevealUI AI provider uses this directly with zero additional configuration.

### Available Models

| Snap | Type | RAM | Use Case |
|------|------|-----|----------|
| `nemotron-3-nano` | General (reasoning + non-reasoning) | ~4 GB | **Free tier default**  -  fast, lightweight |
| `gemma3` | General + vision | ~8 GB | Image understanding, multimodal tasks |
| `deepseek-r1` | Reasoning | ~16 GB | Complex analysis, chain-of-thought |
| `qwen-vl` | Vision-language | ~8 GB | Document parsing, visual Q&A |

### Configuration

```bash
# Set in your .env or environment
INFERENCE_SNAPS_BASE_URL=http://localhost:9090/v1
```

When `INFERENCE_SNAPS_BASE_URL` is set, the LLM client auto-detects it as the primary provider. No additional configuration needed.

### Why Inference Snaps

- **Single command install**  -  `sudo snap install <model>`, no Python, no Docker, no manual downloads
- **Hardware-aware**  -  automatically selects the best engine for your CPU/GPU/TPU
- **Signed and verified**  -  Canonical signs every snap, verified on install
- **Fully offline**  -  runs entirely on your hardware after initial download
- **OpenAI-compatible**  -  same API contract as cloud providers, drop-in replacement
- **Auto-updates**  -  snaps update automatically with security patches and model improvements

## All Inference Paths

| Path | Runtime | Cost | Use Case |
|------|---------|------|----------|
| **Ubuntu Inference Snaps** (recommended) | Canonical snap runtime | Free (your hardware) | Production  -  Gemma 4, Nemotron-Nano, DeepSeek-R1, Qwen-VL |
| **Ollama** | Local GGUF models | Free (your hardware) | Flexible  -  any open source GGUF model (Gemma 4, Qwen, Mistral) |
| **HuggingFace** | HuggingFace Inference API | API usage costs | Open models hosted on HuggingFace infrastructure |
| **Vultr** | Vultr GPU Cloud | API usage costs | Open models on Vultr serverless inference |

## Ollama (Open Source Models)

Run any open source model locally via the RevealUI harness.

```bash
ollama pull gemma4:e2b            # Chat model (Gemma 4 — Apache 2.0)
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
3. `GROQ_API_KEY`
4. `OLLAMA_BASE_URL`
5. `HUGGINGFACE_API_KEY`
6. `VULTR_API_KEY`

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

- Local providers (snaps, Ollama): no API keys leave your infrastructure
- Cloud providers (HuggingFace, Vultr): data is sent to your chosen cloud endpoint, but only open models are used  -  no proprietary APIs
- Full air-gap capability with Ollama (zero network required after model download)
- Inference snaps are signed and verified by Canonical
