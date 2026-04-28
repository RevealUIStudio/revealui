# Open-Model Inference

RevealUI AI defaults to open-model inference (Snaps, Ollama). Cloud-compatible providers (Groq, HuggingFace, OpenAI-compatible endpoints) are pluggable but opt-in via environment variables.

## Planned: Ubuntu Inference Snaps

**Inference Snaps** from Canonical are the planned recommended path for local AI with RevealUI. Today, you install + run the snap yourself, then point RevealUI at it via `INFERENCE_SNAPS_BASE_URL`. Studio lifecycle management (start / stop / health / model discovery) is on the roadmap; until that ships, treat Snap operations as standalone (Ollama is the practical default for most users today).

```bash
# Install the free tier default model
sudo snap install nemotron-nano

# Check status and endpoint
nemotron-nano status

# Optional: change the HTTP port (default 9090)
nemotron-nano set http.port=9090
```

The snap serves an OpenAI-compatible API at `http://localhost:<port>/v1`  -  the RevealUI AI provider uses this directly with zero additional configuration.

### Available Models

| Snap | Type | RAM | Use Case |
|------|------|-----|----------|
| `nemotron-nano` | General (reasoning + non-reasoning) | ~4 GB | **Free tier default**  -  fast, lightweight |
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
| **Ollama** (default) | Local GGUF models | Free (your hardware) | Flexible  -  any open source GGUF model (Gemma 4, Qwen, Mistral) |
| **Ubuntu Inference Snaps** (planned) | Canonical snap runtime | Free (your hardware) | Local production  -  Gemma 3, Nemotron-Nano, DeepSeek-R1, Qwen-VL |
| **HuggingFace** | HuggingFace Inference API | API usage costs | Open models hosted on HuggingFace infrastructure |

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

## Auto-Detection

The LLM client factory auto-detects your inference path in this order:

1. `LLM_PROVIDER` (explicit override)
2. `INFERENCE_SNAPS_BASE_URL`
3. `GROQ_API_KEY`
4. `OLLAMA_BASE_URL`
5. `HUGGINGFACE_API_KEY`

## Server-side Usage

```typescript
import { createLLMClientFromEnv } from '@revealui/ai/llm/client'

// Auto-detects from environment
const llm = createLLMClientFromEnv()

const response = await llm.chat([
  { role: 'user', content: 'Hello!' },
])
```

## Security

- Local providers (snaps, Ollama): no API keys leave your infrastructure
- Cloud providers (Groq, HuggingFace, OpenAI-compatible): data is sent to your chosen endpoint when API keys are configured. Picking only open-weights models is your choice; the package supports both.
- Air-gap capability with Ollama (zero network required after model download). The default RevealUI deployment also depends on cloud services (Postgres / Stripe / Blob storage) — the local AI path is optional, not a guarantee that the whole stack runs offline.
- Inference snaps are signed and verified by Canonical
