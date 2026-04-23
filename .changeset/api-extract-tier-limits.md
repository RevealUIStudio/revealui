---
'api': patch
---

Extract `getHostedLimitsForTier` into `apps/api/src/lib/tier-limits.ts`.

Pure refactor — no behavior change. The function (and its `HostedTierLimits` shape + `HostedTierId` union) moves out of `apps/api/src/routes/webhooks.ts` into a dedicated module so `seat-count-guard.ts` and future limit-driven paths can import the same canonical values without re-declaring the per-tier limits.

Completes the deferred follow-up called out in the seat-count-guard changeset (2026-04-19): the guard already takes `maxUsers` as a parameter so this extraction isn't a blocker for the guard, but having one source of truth for the four hosted tiers is a prerequisite for any future path that needs both the limit and the guard on the same `accountMemberships` insert.

Tests that oracle against the limits (`pricing-accuracy.test.ts`, `billing-feature-matrix.test.ts`, `checkout-to-feature-e2e.test.ts`) retain their independent expected-values — they're drift-catchers, not consumers — with their "must match" comments updated to point at the new path.

All 2274 api tests pass.
