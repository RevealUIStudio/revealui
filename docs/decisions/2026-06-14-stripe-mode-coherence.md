---
title: "ADR: Stripe Mode Coherence — One Ground Truth, Derived or Verified Everywhere"
description: "Replaces the emergent test/live mode (≈7 independently-set config values) with a single ground truth — the deployed secret key — that all other mode-bearing values are derived from or verified against, and forbids swallowing provider errors."
visibility: public
status: proposed
audience: developer
---

**Date**: 2026-06-14
**Status**: Proposed — layer 3 shipped ([#1460](https://github.com/RevealUIStudio/revealui/pull/1460)); layers 1-2 await owner sign-off
**Deciders**: RevealUI Studio (single-founder)
**Tracking issue**: [revealui#1461](https://github.com/RevealUIStudio/revealui/issues/1461)

---

## Context

Pro/Max checkout on `admin.revealui.com/account/billing` failed in production with a generic **400 "Invalid billing request. Please contact support if this persists."** Investigation established:

- The route is correctly mounted (`app.route('/api/billing', billingRoute)`, path `/checkout`) and reachable — the failure is a **400 from inside the handler**, not a 404/401.
- The client sends no `priceId` (request body is `{"tier":"pro"}`), so the price resolves **solely from the `billing_catalog` table** (`resolveCatalogPriceId`, `apps/server/src/routes/billing.ts`). Stripe then rejected `checkout.sessions.create` with a `StripeInvalidRequestError`.
- `withStripe` mapped that error to the generic 400 **without logging the original** — so the actual cause was undiagnosable from logs.

The underlying defect is not a single bad value. **"Test vs live" is an emergent property** that only holds when ~7 independently-set values agree, none of which is authoritative:

1. deployed secret key (`sk_live`/`sk_test`) — today guarded only against `STRIPE_LIVE_MODE` (`packages/services/src/stripe/mode.ts`)
2. `STRIPE_LIVE_MODE` (a redundant second source of the same fact)
3. `billing_catalog.stripe_price_id` rows in the prod DB
4. `STRIPE_AGENT_OVERAGE_PRICE_ID` (env)
5. early-adopter coupon IDs (env, `getEarlyAdopterDiscount`)
6. publishable key baked into the admin build
7. stored Stripe customer IDs (Stripe customers are mode-scoped)

Two facts make this acute:

- **`billing_catalog` is single-mode by construction.** Its unique index is on `plan_id` alone (`packages/db/src/schema/accounts.ts:166`), so it cannot hold a test and a live row for `subscription:pro` simultaneously. A full re-seed is the only way to flip it — exactly the owner-gated "live Stripe re-seed" ritual, and exactly what a `revvault sync vercel` key flip silently desyncs.
- **The money path runs no boot validation.** `validate-startup` runs on the Fly worker and the dev block, never on the Vercel serverless API (memory: `vercel-api-no-boot-validation`). The only code reliably executing on every cold start of the money path is the Stripe client factory (`getStripe`, `packages/services/src/stripe/stripeClient.ts:17`).

Price IDs carry **no mode marker** in the string (`price_…` in both modes), so the mismatch is unverifiable offline and only manifests as a Stripe API rejection.

## Decision

Establish a **mode-coherence invariant** and enforce it in three layers:

> **The deployed secret key's prefix is the single ground truth for Stripe mode. Every other mode-bearing value is either selected from it or verified against it. `STRIPE_LIVE_MODE` demotes from an input to a tripwire. Provider errors are never swallowed without logging their diagnostics.**

### Layer 3 — never swallow the provider error (shipped, #1460)

`withStripe` now logs the original Stripe error's diagnostic fields (`type`/`code`/`param`/`statusCode`/`requestId`/`message` — none secret) before remapping: `warn` for expected outcomes (card declines, rate limits), `error` otherwise. Generalize to a review rule: any external-service error mapping logs the original before remapping. This is the diagnosability floor — the next incident is a log-read, not an investigation.

### Layer 1 — eliminate internal drift: mode-key the catalog

- Add a `mode` column (`'live' | 'test'`) to `billing_catalog`.
- Change the unique index from `(plan_id)` to `(plan_id, mode)`.
- `resolveCatalogPriceId` selects the row whose `mode` matches the deployed key's actual mode (`classifyStripeSecretKey`).
- Fold the overage meter price into the catalog (`billing_model = 'metered'` or a dedicated row) so it stops being a loose, unverified env var.

Result: flipping the key auto-selects matching prices; internal mismatch becomes structurally impossible; the re-seed-on-flip ritual disappears (seed both modes once).

### Layer 2 — verify against Stripe reality at the money boundary

- On the first money operation per cold instance, retrieve each resolved price + active coupon with the deployed key.
- Refuse checkout with a precise, named error (e.g. *"catalog price `price_x` for `subscription:pro` not found under the deployed test-mode key"*) on any 404 or mode disagreement.
- Cache the verdict per-instance with a TTL so the verification is once-per-cold-start, not per-request.

Result: catches what layer 1 cannot — archived/deleted/typo'd prices, a stale coupon, a key rotated out from under the catalog — at the only layer that runs on Vercel serverless.

## Options considered

- **Re-seed the prod catalog / fix the env to match (patch only).** Unblocks this instance; leaves all 7 axes free to drift again on the next key flip. **Rejected** — explicitly not a durable solution.
- **CI/deploy preflight that checks coherence.** Good defense-in-depth, but validates the deploy snapshot, not the serverless cold-start, and cannot see a runtime key rotation. **Subsumed** by layer 2; acceptable as an optional extra gate later, not the core.
- **Mode-keyed catalog (layer 1) — chosen** for internal consistency by construction.
- **Boundary verification with per-instance cache (layer 2) — chosen** for consistency with Stripe's actual state, on the only code path guaranteed to run.
- **Derive mode purely from the key and drop `STRIPE_LIVE_MODE` entirely.** Attractive (removes axis 2), but `STRIPE_LIVE_MODE` is valuable as an explicit *declared intent* tripwire — keeping it as an assertion (must match the key) is cheap defense-in-depth. **Kept as tripwire, demoted from input.**

## Consequences

- **Schema migration** (Drizzle): add `mode` column + recreate the unique index as `(plan_id, mode)`. Existing rows backfilled to the mode they were seeded for. Seed scripts populate both modes.
- **First-checkout latency** on a cold instance gains one or two Stripe `retrieve` calls; bounded by the per-instance cache and acceptable on the rare cold start. Measured before/after.
- **Re-seed-on-flip ritual removed** from the owner-gated runbook; flipping `STRIPE_LIVE_MODE` + key becomes sufficient and self-verifying.
- The `mode.ts` coherence guard extends from "key shape vs `STRIPE_LIVE_MODE`" to "key + catalog + coupon + meter," consolidating the contract in one module (its stated design — enforcement point #1 = the client factory).
- Layers 1 and 2 touch the **money path and the DB schema**; both are owner-gated and land as separate PRs after this ADR is accepted, each with its own verification (unit + the relational integration suite against real Postgres).

## Implementation plan

1. **Layer 3** — shipped (#1460), targets `test`.
2. **Layer 1** — schema migration + `resolveCatalogPriceId` mode selection + meter-into-catalog + seed-both-modes; PR targets `test`. Gate: integration tests prove a test-key deploy selects test rows and a live-key deploy selects live rows.
3. **Layer 2** — boundary verification + per-instance cache in the client factory / first checkout; PR targets `test`. Gate: a deliberately mismatched fixture yields the precise named error, not a generic 400.
4. Update the owner runbook (remove re-seed-on-flip) and `docs/SECRETS.md` mode notes.

Owner-gated: any change that flips `STRIPE_LIVE_MODE`, re-seeds live Stripe, or rotates keys remains owner-executed.
