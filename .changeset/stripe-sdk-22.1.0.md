---
'@revealui/services': patch
---

Bump Stripe SDK to ^22.1.0 (latest as of 2026-04-28; default API version `2026-04-22.dahlia`). Replace hardcoded `apiVersion` strings across the codebase with `Stripe.API_VERSION` so future SDK upgrades auto-track the API version in lockstep instead of leaving stale date stamps. Also fixes the CJS import in `scripts/setup/seed-stripe.ts` for SDK 22+ (closes GAP-155).
