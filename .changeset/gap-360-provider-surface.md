---
"@revealui/ai": minor
"@revealui/db": minor
---

Widen the LLM provider surface with Anthropic and OpenAI (no behavior change).

`@revealui/ai`: `LLMProviderType` now includes `anthropic` and `openai`, added to
the `createProvider` factory as OpenAI-compatible wrappers (Anthropic at
`https://api.anthropic.com/v1`, OpenAI at `https://api.openai.com/v1`) with
conservative default models. Fixes a latent defect where `huggingface` was
accepted by the env factory but had no `createProvider` case and threw at first
use. `createLLMClientFromEnv` auto-detects the two new providers after the
existing checks so existing deployments resolve identically, and now emits the
one-line boot warning it always documented when the zero-config localhost default
is selected. The OpenAI-compatible client sets a 60s request timeout and one
retry so an unreachable endpoint fails fast instead of burning the serverless
duration. Exports a `hostedViable` classification for later resolver/UI wiring.

`@revealui/db`: migration widening the provider CHECK constraints on
`user_api_keys` and `workspace_inference_configs` (and the latter's key-pairing
CHECK) to allow `anthropic` and `openai`. Constraint-widening only, idempotent,
no backfill.
