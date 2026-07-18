---
'@revealui/core': patch
---

Add a 1s idempotency tolerance (`coversRenewalBound`) to the GAP-287 PR-2 subscription renewal re-mint decision, so a stored license `exp` landing exactly 1s below the new period bound (a flooring artifact of the relative-TTL derivation and the JWT signer's own second granularity) is treated as already covering it. Fast-follow on a non-blocking finding from the #1978 guardrail-2 verdict: without this, a duplicate/retried `invoice.payment_succeeded` on that 1s boundary re-entered the re-mint path instead of no-opping (bounded churn, never an entitlement or money error).
