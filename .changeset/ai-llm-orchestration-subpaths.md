---
'@revealui/ai': minor
---

Add subpath exports for AI caching, orchestration, and skills registry helpers:

- `@revealui/ai/llm/cache-utils` — `withCache`, `cacheableSystemPrompt`, and related prompt-caching helpers
- `@revealui/ai/llm/response-cache` — `getGlobalResponseCache`, `calculateResponseCacheSavings`
- `@revealui/ai/llm/semantic-cache` — `getGlobalSemanticCache`, `calculateSemanticCacheSavings`
- `@revealui/ai/orchestration/runtime` — non-streaming agent runtime (complement to the existing `./orchestration/streaming-runtime`)
- `@revealui/ai/skills/registry` — `globalSkillRegistry`, `SkillRegistry`, `SkillStorageConfig`

Docs under `docs/ai/PROMPT_CACHING.md`, `docs/ai/RESPONSE_CACHING.md`, and `docs/ai/SEMANTIC_CACHING.md` reference these paths; they previously resolved only via deep relative paths.
