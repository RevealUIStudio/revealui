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
option; `generateEmbedding` accepts an optional pre-resolved client. Emits a
one-time operator warning when the hosted BYOK dispatch flag is explicitly
disabled (every account shares the deployment env client while the lever is
pulled).

Security fix (guardrail-2): the durable worker now derives dispatch identity
from the authenticated dispatcher captured server-side at enqueue time, never
from `ticket.reporterId` — that column is client-writable via the general
tickets API with no ownership check, so reading it for key resolution would
let an attacker who owns a board decrypt a victim's BYOK key by planting the
victim's user id in `reporterId` before dispatching.
