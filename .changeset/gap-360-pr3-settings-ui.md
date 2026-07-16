---
"@revealui/contracts": minor
---

Widen `LLM_PROVIDERS` to include `anthropic` and `openai` (GAP-360 PR-3). PR-1
(`@revealui/ai`, `@revealui/db`) already widened `LLMProviderType` and the DB
provider CHECK constraints to six providers, but left this canonical list at
four — so the two BYOK routes that import it (`apps/server/src/routes/api-keys.ts`,
`packages/mcp/src/servers/factories/contracts.ts`) still rejected a saved
Anthropic/OpenAI key. This closes that gap; no other behavior changes.
