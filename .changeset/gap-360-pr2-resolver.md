---
"@revealui/ai": minor
---

Add the per-request LLM client resolver (GAP-360 PR-2). `resolveLLMClientForRequest`
is the single home for key resolution at every agent-dispatch site: per-user BYOK
first, then site-level inference config, then deployment env on self-hosted only.
On hosted, an unconfigured account fails closed with a typed `LLMNotConfiguredError`
(HTTP 409 naming `/settings/api-keys`) instead of silently falling through to the
localhost default. Gated behind `HOSTED_BYOK_DISPATCH` so self-hosted env-first
behavior is byte-unchanged. `createLLMClientForUser` gains a `hostedViableOnly`
option; `generateEmbedding` accepts an optional pre-resolved client.
