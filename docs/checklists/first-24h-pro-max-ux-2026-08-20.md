---
title: "First-24h Pro/Max UX verification index (2026-08-20)"
description: "Index only. The receipt is signed audit_log rows, not this markdown."
visibility: internal
status: verified
audience: maintainer
---

# First-24h Pro/Max UX verification

**Date:** 2026-08-20
**Base branch:** `test`
**Work branch:** `cursor/first-week-pro-max-ux-6664`
**No GitHub issue is closed by this work.**

## This file is not the receipt

Public-facing / customer-centric completed work uses RevealUI agent receipts.
A PR body or markdown checklist is **not** the receipt.

Receipts are signed `audit_log` rows through the existing door
(`DrizzleAuditStore.append` / `appendBatch` — same door as MCP tool receipts
and `harness-receipt-audit.ts`). Writer + catalog:

- `apps/server/src/lib/first-24h-ux-receipts.ts`
- PGlite proof: `apps/server/src/lib/__tests__/first-24h-ux-receipts.pglite.test.ts`

Each tested surface is one receipt with actor, action, plan (Pro vs Max),
result PASS/FAIL/SKIP, evidence, and timestamp. Max rows say Max.

If this report is rendered in admin or docs, use `@revealui/presentation`
`ReceiptCard` via `First24hUxReceiptCard`. No homemade receipt UI.

Checking a receipt is free. This work does **not** deliver Max `auditLog`
Merkle roots or sealed root download. `merkleRootDelivered` on every row is
`false`.

## Verdict

**First-24h UX is not guaranteed.**

The essential cron-lifecycle-production SKIP is gone (production stay-disarmed
is now a PASS). The remaining essential SKIP is `real-mailbox-delivery`: the
Gmail path is documented on hosted test/staging (GAP-343) but live inbox
delivery was not exercised. See
`first24hUxGuaranteed(FIRST_24H_UX_SURFACES_2026_08_20) === false`.

## Audit hypotheses (2026-08-19 charge-gate)

| Hypothesis | Result | Notes |
|---|---|---|
| Max copy says Pro | **Verified, fixed** | Admin billing hardcoded “Your Pro trial…” / “Your Pro features…”. Signup, welcome, `tierLabel()`, and marketing CTAs were already plan-specific. |
| `expiresAt` is weak | **Verified, fixed** | `GET /api/billing/subscription` returned `expiresAt: null` on hosted-entitlement and hosted-snapshot short-circuits even when `licenses.expiresAt` stored Stripe `trial_end`. |
| Lifecycle emails disarmed | **Verified, hold was intentional** | Templates, dispatcher job, and Gmail provider already existed. Cron was gated by `LIFECYCLE_EMAILS_ENABLED` so production would not blast the sequence. Hosted test now arms when the mailbox path is present. Production (main) stays disarmed. |

## Commands actually run

Environment: Node 24.13.0, pnpm 10.28.2, packages built with `pnpm turbo run build --filter='./packages/*'` (30/30).

| Command | Result |
|---|---|
| `pnpm --filter admin test` (full admin Vitest) | 2188 passed, 9 skipped, 179 files passed / 1 skipped |
| `pnpm --filter server test` (full server Vitest) | 3440 passed, 1 skipped, 217 files passed |
| `pnpm --filter marketing test` (full marketing Vitest) | 181 passed, 28 files passed |
| `pnpm exec vitest run` admin billing/welcome/trial-copy (verbose) | 17 passed |
| `pnpm exec vitest run` server billing + lifecycle + webhook-emails-trial (verbose) | 86 passed |
| `pnpm exec vitest run` SignupForm (verbose) | 6 passed |
| `pnpm exec vitest run` PricingPage + landing-honesty (verbose) | 12 passed |

No live Stripe charges. No real mail sent.

## Surfaces

The surface list, results, and evidence live on the receipt catalog
(`FIRST_24H_UX_SURFACES_2026_08_20`), persisted through the audit door in the
PGlite test. Do not treat the table below as the SoT.

Essential SKIP: `real-mailbox-delivery` (no live inbox proof in this work).
Non-essential SKIP: `live-stripe-e2e`.
No FAIL rows. `cron-lifecycle-production` is PASS (production remains disarmed).

## Leftovers

1. **Owner inbox check on hosted test.** Confirm `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, and `EMAIL_FROM` are present on vercel:api-staging (GAP-343 already maps them). Then trigger `POST /api/cron/dispatch` (or wait for the daily 06:00 UTC cron on the staging project) against a known Pro/Max test account. Do not set `LIFECYCLE_EMAILS_ENABLED=true` on production/`main`.
2. **No live Stripe walk.** First charge / trial start in Stripe Checkout was not executed here.
3. **Welcome page does not show `expiresAt`.** It shows the plan label and links to billing. Expiry is on billing + license after the API fix.
4. **Security Review Gate.** Earlier billing-route work may still need `sec-review:approved` from a raw terminal. This arming PR does not change billing/auth routes.
5. **No Merkle root delivery.** Checking a receipt is free; sealed range roots remain Max `auditLog` only and were not implemented here.
6. **Vercel preview crons.** Vercel invokes crons on a project's production deployment. Persistent staging (`api.staging.revealui.com`, production branch `test`) is the hosted-test fire path. Preview-only URLs from `deploy-test.yml` need a manual dispatch.

## Doors not touched

SSO/#449, Stripe live catalog/keys, license-key migration, Starter Kit checkout, Enterprise unattended checkout. Pro/Max Start trial and Buy CTAs were not hidden or weakened.
