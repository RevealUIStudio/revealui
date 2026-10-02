---
'@revealui/ai': patch
'@revealui/db': patch
---

Bind A2A task reads, cancellation, and execution reservations to trusted actor/account scope. Reject colliding task IDs before metering, consume execution reservations once, and preserve cancellation when a provider finishes or rejects afterward. Continue pending-payment tasks only with unchanged input and the existing payment verifier's successful result.

This does not provide cross-task payment-proof consumption: `packages/paywall/src/x402/index.ts` calls facilitator `/verify` and exposes no settlement or durable nonce claim. That owning payment boundary needs verified settlement/nonce binding and cross-task replay tests before paid readiness can be claimed. The server's existing fire-and-forget `agentActions` write and the task store's unbounded cache also require the separately tracked durable receipt/admission followups; this change does not claim persistence across restart.
