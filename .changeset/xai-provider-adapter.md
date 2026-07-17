---
"@revealui/ai": minor
---

add xai (Grok) as a BYOK LLM provider: a thin OpenAI-compatible wrapper over `https://api.x.ai/v1` (default model `grok-4.5`), following the existing anthropic/groq adapter pattern (no vendor SDK). Wires `xai` into `LLMProviderType`, `hostedViable`, `createProvider`, `createLLMClientFromEnv` (`XAI_API_KEY`/`XAI_BASE_URL`), and the admin Settings, API Keys provider list.
