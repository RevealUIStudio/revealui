---
"@revealui/harnesses": minor
---

Add a `gates` subpath export (GAP-408 control-layer redesign): `evaluateGuardrail2` / `verdictForBody` / `collectVerdicts` (the guardrail-2 verdict-marker parser) and `SHARED_DETECTION_RULES` / `COMMON_EXON` / `STRIPE_LIVE_EXON` (the doc-currency stale-fact detection data). These are now the single editable source for logic that `scripts/validate/guardrail2-verdict.cjs` and `scripts/validate/doc-currency.ts` load at runtime, and that the private revealui-jv checkout's equivalent scripts resolve via an adapter — no vendored copies on either side of the public/private boundary.
