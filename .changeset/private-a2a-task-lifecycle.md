---
'@revealui/ai': major
'@revealui/db': minor
---

Bind A2A task reads, cancellation, and execution reservations to trusted actor/account scope. Reject colliding task IDs before metering, consume execution reservations once, and preserve cancellation when a provider finishes or rejects afterward. Continue pending-payment tasks only with unchanged input and the existing payment verifier's successful result.

Public API migration: pass an authenticated `AgentActionScope` to task creation/read/cancellation and a trusted canonical agent/definition binding when creating reservations. Pass the same scope through the JSON-RPC handler options; omitted scope fails closed. Scope comes from authenticated middleware and resolved account context, never request metadata. Existing unscoped global access is intentionally removed.

This does not provide cross-task payment-proof consumption: `packages/paywall/src/x402/index.ts` calls facilitator `/verify` and exposes no settlement or durable nonce claim. That owning payment boundary needs verified settlement/nonce binding and cross-task replay tests before paid readiness can be claimed. The server's existing fire-and-forget `agentActions` write and the task store's unbounded cache also require the separately tracked durable receipt/admission followups; this change does not claim persistence across restart.

Memory and fair admission remain unbounded in the owning task store. The server's maintained `body-limits.ts` caps HTTP JSON at 1MiB, but `packages/contracts/src/a2a/index.ts` has no retained message/artifact/history byte limits, direct handler calls bypass that HTTP gate, and provider output is not bounded before retention. `apps/server/src/app.ts` rate limits A2A discovery but not the dispatcher/stream; it supplies no trusted actor/account active cap. After durable receipts, extend the existing A2A validation/configuration, dispatcher rate-limit middleware, and same private entry with total/per-scope admission and retained-byte ceilings. Protect unpersisted terminal outcomes from eviction; verify authenticated DB replay parity, oversized inputs/outputs, one-principal saturation, and protected receipt-write-failure capacity. Pass model-derived output limits through the existing chat contract; do not truncate output and claim successful delivery.
