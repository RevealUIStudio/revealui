# Open-Model Inference

RevealUI AI defaults to open-model inference (Snaps, Ollama). Groq, Anthropic, OpenAI, and HuggingFace are pluggable, opt-in cloud adapters. Each one is a thin wrapper that calls the vendor's OpenAI-compatible HTTP endpoint using your own API key. RevealUI never hosts a model and ships no proprietary vendor SDK.

## Planned: Ubuntu Inference Snaps

**Inference Snaps** from Canonical are the planned recommended path for local AI with RevealUI. Today, you install + run the snap yourself, then point RevealUI at it via `INFERENCE_SNAPS_BASE_URL`. Studio lifecycle management (start / stop / health / model discovery) is on the roadmap; until that ships, treat Snap operations as standalone (Ollama is the practical default for most users today).

```bash
# Install the default model (US-origin allowlist)
sudo snap install nemotron-3-nano

# Check status and endpoint
nemotron-3-nano status

# Optional: change the HTTP port (default 9090)
nemotron-3-nano set http.port=9090
```

The snap serves an OpenAI-compatible API at `http://localhost:<port>/v1`  -  the RevealUI AI provider uses this directly with zero additional configuration.

### Product allowlist (US-origin only)

RevealUI rejects non-US snap model IDs at provider construction. Canonical's
catalog may still list other models; product code will not use them unless the
operator sets `REVEALUI_ALLOW_NON_US_MODELS=1` (never seed this).

| Snap | Origin | Type | Use Case |
|------|--------|------|----------|
| `nemotron-3-nano` | NVIDIA (US) | General + tools | **Default** |
| `nemotron-3-nano-omni` | NVIDIA (US) | Multimodal | Text/image/video/audio in |
| `gemma4` | Google (US) | General + vision + tools | Strong general alternative |
| `gemma3` | Google (US) | General + vision | Legacy allowlisted snap |

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
| **Ubuntu Inference Snaps** (planned) | Canonical snap runtime | Free (your hardware) | Local production  -  US-origin: Nemotron 3 Nano/Omni, Gemma 3/4 |
| **Groq** | Cloud, your own key | Pay Groq directly | Fast cloud inference, opt-in via `GROQ_API_KEY` |
| **Anthropic** | Cloud, your own key | Pay Anthropic directly | Bring your own key, opt-in via `ANTHROPIC_API_KEY` |
| **OpenAI** | Cloud, your own key | Pay OpenAI directly | Bring your own key, opt-in via `OPENAI_API_KEY` |
| **HuggingFace** | Cloud, your own key | Pay HuggingFace directly | Bring your own key, select explicitly via `LLM_PROVIDER=huggingface` |

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

`huggingface` calls the HuggingFace OpenAI-compatible inference endpoint using your own token. It is not part of the auto-detect cascade, so select it explicitly with `LLM_PROVIDER=huggingface`.

```bash
LLM_PROVIDER=huggingface
HF_TOKEN=hf_xxxxx
HF_MODEL_URL=https://your-model-endpoint.huggingface.cloud
```

## Anthropic and OpenAI

`anthropic` and `openai` are bring-your-own-key cloud adapters. Each one is a thin wrapper that calls the vendor's own OpenAI-compatible HTTP endpoint with your key. RevealUI ships no proprietary Anthropic or OpenAI SDK.

```bash
# Anthropic
ANTHROPIC_API_KEY=sk-ant-xxxxx
# ANTHROPIC_BASE_URL defaults to https://api.anthropic.com/v1

# OpenAI
OPENAI_API_KEY=sk-xxxxx
# OPENAI_BASE_URL defaults to https://api.openai.com/v1
```

## Auto-Detection

The LLM client factory auto-detects your inference path in this order:

1. `LLM_PROVIDER` (explicit override)
2. `INFERENCE_SNAPS_BASE_URL`
3. `GROQ_API_KEY`
4. `OLLAMA_BASE_URL`
5. `ANTHROPIC_API_KEY`
6. `OPENAI_API_KEY`
7. Falls back to Inference Snaps if none of the above are set

`huggingface` works as an `LLM_PROVIDER` value, but it is not part of this auto-detect cascade. Set `LLM_PROVIDER=huggingface` explicitly to use it.

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
- Cloud providers (Groq, Anthropic, OpenAI, HuggingFace): data is sent to your chosen vendor endpoint using your own API key. Picking only open-weights models is your choice. The package supports both.
- Air-gap capability with Ollama (zero network required after model download). The default RevealUI deployment also depends on cloud services (Postgres, Stripe, Blob storage). The local AI path is optional, not a guarantee that the whole stack runs offline.
- Inference snaps are signed and verified by Canonical
