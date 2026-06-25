---
title: "Stripe Go-Live Cutover Runbook (Gate 6)"
description: "Sequence to flip the production API from Gate-5 test-mode to live Stripe, including undoing the test-mode overrides."
visibility: internal
status: draft
audience: maintainer
---

# Stripe Go-Live Cutover Runbook (Gate 6)

**Who:** Owner (founder) — live-mode flip is owner-gated; no agent flips `STRIPE_LIVE_MODE=true` without explicit sign-off.
**When:** After Gate-5 (test-mode conversion walkthrough) passes and the billing-readiness audit is closed.
**Goal:** Move the production API from the Gate-5 **test-mode override** state to a coherent **live** state, in a single redeploy, then verify with the existing smoke + monitor runbooks.

This runbook is the **orchestration layer**. It does not duplicate verification — once the flip is done, hand off to:
- [`checkout-smoke-production.md`](./checkout-smoke-production.md) — $1 real-card end-to-end smoke (run every payment deploy).
- [`stripe-post-flip-72h-monitor.md`](./stripe-post-flip-72h-monitor.md) — first-72h live monitoring (run once after the flip).
- [`vercel-env-sync.md`](./vercel-env-sync.md) — the canonical `revvault → Vercel` env workflow used in step 2.

---

## Background: the Gate-5 test-mode overrides to undo

During Gate-5 (2026-06-14) the production **revealui-api** Vercel project was put into a deliberate **test-mode override**, set Vercel-direct (NOT via `revvault sync`, so the canonical live values in `revvault` are untouched):

| Vercel var (revealui-api) | Gate-5 override | Canonical (live) source in revvault |
|---|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_…` | `revealui/prod/stripe/secret-key` (`sk_live_…`) |
| `STRIPE_WEBHOOK_SECRET` | test endpoint `whsec_…` | `revealui/prod/stripe/webhook-secret` |
| `STRIPE_WEBHOOK_SECRET_LIVE` | test endpoint `whsec_…` | `revealui/prod/stripe/webhook-secret-live` |
| `STRIPE_LIVE_MODE` | `false` | (Vercel-direct toggle; in the sync `skip` list — never synced) |
| `billing_catalog` (prod DB) — **mode-keyed** | test-mode rows seeded | seed **live-mode** rows alongside (step 3); the flip switches which mode is read, not the data |

The Gate-5 test key (`revealui/dev/stripe/secret-key`) and test webhook secret (`revealui/dev/stripe/webhook-secret`) were stored in revvault under the `dev/` namespace and must be **rotated/removed** at the end (step 7).

> **Why a single redeploy (steps 2–5 before step 6).** Once [#1441](https://github.com/RevealUIStudio/revealui/pull/1441) (Stripe mode-coherence guard) and [#1443](https://github.com/RevealUIStudio/revealui/pull/1443) (Vercel cold-start `validateStartup`) are on `main`, the API **refuses to construct the Stripe client / boot** when the key environment contradicts `STRIPE_LIVE_MODE`. So you must set the live key **and** flip `STRIPE_LIVE_MODE=true` **and** seed the live catalog **before** the redeploy — never deploy in a half-flipped state.

---

## 0. Pre-flip gates (block until all true)

- [ ] Gate-5 conversion walkthrough passed (checkout opens + webhook fulfills in test mode).
- [ ] Coherence-guard PRs merged to `main`: [#1441](https://github.com/RevealUIStudio/revealui/pull/1441), [#1443](https://github.com/RevealUIStudio/revealui/pull/1443). (Also [#1444](https://github.com/RevealUIStudio/revealui/pull/1444) pricing-CORS, [#1442](https://github.com/RevealUIStudio/revealui/pull/1442) toml dupes.)
- [ ] **Live webhook `apiVersion` is correct.** The handoff flagged a live endpoint with a stale `apiVersion`. In the Stripe Dashboard (LIVE mode) → Developers → Webhooks, confirm the live endpoint's API version matches the SDK's pinned version (`Stripe.API_VERSION`), or delete + recreate it. If recreated, copy the new signing secret into `revvault set revealui/prod/stripe/webhook-secret-live`.
- [ ] `SENTRY_DSN` and the other `REQUIRED_IN_PRODUCTION_HOSTED` vars are set in the live Vercel env (now enforced at cold start by `apps/server/src/lib/validate-startup.ts` once #1443 is live).
- [ ] Owner sign-off to flip `STRIPE_LIVE_MODE=true`.

---

## 1. Confirm canonical live values exist in revvault

```bash
cd ~/revfleet/revealui
revvault get --full revealui/prod/stripe/secret-key | cut -c1-8        # expect sk_live_
revvault get --full revealui/prod/stripe/webhook-secret | cut -c1-6    # expect whsec_
revvault get --full revealui/prod/stripe/webhook-secret-live | cut -c1-6  # expect whsec_ (live endpoint)
```

If the live webhook secret was rotated in the pre-flip gate, make sure `revvault set revealui/prod/stripe/webhook-secret-live` reflects the new value.

## 2. Restore live secrets to Vercel (undo the test-mode override)

Use the canonical sync — this overwrites the Gate-5 Vercel-direct test values with the live revvault values. See [`vercel-env-sync.md`](./vercel-env-sync.md).

```bash
cd ~/revfleet/revealui
revvault sync vercel --manifest scripts/sync/revvault-vercel.toml   # or the pnpm wrapper
```

`STRIPE_LIVE_MODE` is in the manifest `skip` list, so the sync does **not** touch it — you flip it explicitly in step 4. Confirm the secret-key + webhook vars now resolve to live (the sync reports each var).

## 3. Re-seed billing_catalog with LIVE price IDs

The prod `billing_catalog` currently holds **test** price IDs from Gate-5. Re-seed against the **live** Stripe account so it holds live price IDs. The seed picks live/test by key prefix and prints a 5-second LIVE warning — this is intentional.

```bash
cd ~/revfleet/revealui
STRIPE_SECRET_KEY="$(revvault get --full revealui/prod/stripe/secret-key)" \
POSTGRES_URL="$(revvault get --full revealui/prod/db/postgres-url)" \
pnpm stripe:seed -- --dry-run    # review: products/prices it would create + catalog sync

# then for real (creates/refreshes LIVE products + prices, syncs billing_catalog):
STRIPE_SECRET_KEY="$(revvault get --full revealui/prod/stripe/secret-key)" \
POSTGRES_URL="$(revvault get --full revealui/prod/db/postgres-url)" \
pnpm stripe:seed
```

Verify the catalog now holds live price IDs before flipping (a query against the prod DB requires owner approval).

## 4. Flip `STRIPE_LIVE_MODE=true` (owner-gated)

Set it Vercel-direct on the **revealui-api** project (production target). Look up the env entry ID at runtime rather than hardcoding it:

```bash
VTOKEN="$(revvault get --full revealui/prod/api-keys/vercel-token)"
# Find the STRIPE_LIVE_MODE env id, then PATCH value -> "true" (production target).
# (Same Vercel env API used in vercel-env-sync.md.)
```

## 5. (No deploy yet — verify coherence) Confirm the staged env is internally consistent

Before redeploying, confirm: `STRIPE_SECRET_KEY` = `sk_live_…`, `STRIPE_LIVE_MODE` = `true`, webhook secrets = live, `billing_catalog` = live price IDs. All four must agree — the coherence guard will hard-fail the API otherwise.

## 6. Redeploy the API (single deploy picks up all of the above)

```bash
cd ~/revfleet/revealui
gh workflow run deploy.yml --ref main --field apps=api
gh run watch "$(gh run list --workflow=deploy.yml --limit 1 --json databaseId -q '.[0].databaseId')" --exit-status
```

## 7. Verify + monitor + clean up

- [ ] Run [`checkout-smoke-production.md`](./checkout-smoke-production.md) — $1 real-card end-to-end; confirm DB + Stripe events + license activation.
- [ ] Start [`stripe-post-flip-72h-monitor.md`](./stripe-post-flip-72h-monitor.md).
- [ ] **Rotate** the Gate-5 test credentials (they passed through a chat transcript): roll the `sk_test_` and the test webhook signing secret in the Stripe **test** dashboard.
- [ ] Remove the Gate-5 dev-namespace secrets if no longer needed: `revealui/dev/stripe/secret-key`, `revealui/dev/stripe/webhook-secret`.
- [ ] Delete the Gate-5 **test** webhook endpoint(s) in the Stripe test dashboard (test products/prices are harmless to leave).

---

## Rollback (if smoke fails after flip)

Reverse is symmetric: set `STRIPE_LIVE_MODE=false`, re-apply test key + test webhook secret + re-seed test catalog (Gate-5 procedure), redeploy. Because the coherence guard blocks half-states, do all env changes before the rollback redeploy. Do **not** leave a live key with `STRIPE_LIVE_MODE=false` deployed — it will hard-fail the money path by design.
