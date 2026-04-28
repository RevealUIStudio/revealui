---
'@revealui/core': minor
---

Add x402 observability counters + helpers to the core metrics module:

- `appMetrics.x402PaymentRequiredTotal` — counter, labels `{route, currency}`
- `appMetrics.x402PaymentVerifyTotal` — counter, labels `{route, scheme, result}`
- `appMetrics.x402PaymentVerifyDuration` — histogram, label `{scheme}`
- `appMetrics.x402SafeguardRejectionTotal` — counter, label `{reason}`

New helper functions for emission at call sites:
- `trackX402PaymentRequired(route, currency)`
- `trackX402PaymentVerify(route, scheme, result, durationMs)`
- `trackX402SafeguardRejection(reason)` + exported `X402SafeguardRejectionReason` type

New subpath export: `@revealui/core/observability/metrics` (mirrors the
existing logger subpath). All existing metric helpers continue to work
through the parent `@revealui/core/observability` export.

Counters surface automatically through the existing `/api/metrics`
Prometheus endpoint (gated on `METRICS_SECRET`) and `/api/metrics/json`
endpoint. No new exposure surface needed.

Part of GAP-149 PR 5 — wires the metrics into the x402 verify dispatch
+ all five 402-emission call sites in apps/api.
