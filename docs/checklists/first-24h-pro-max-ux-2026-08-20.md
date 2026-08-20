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

The catalog includes an essential SKIP: cron day-0 / day-1 / day-7 stays
disarmed behind `LIFECYCLE_EMAILS_ENABLED`. See
`first24hUxGuaranteed(FIRST_24H_UX_SURFACES_2026_08_20) === false`.

## Audit hypotheses (2026-08-19 charge-gate)

| Hypothesis | Result | Notes |
|---|---|---|
| Max copy says Pro | **Verified, fixed** | Admin billing hardcoded “Your Pro trial…” / “Your Pro features…”. Signup, welcome, `tierLabel()`, and marketing CTAs were already plan-specific. |
| `expiresAt` is weak | **Verified, fixed** | `GET /api/billing/subscription` returned `expiresAt: null` on hosted-entitlement and hosted-snapshot short-circuits even when `licenses.expiresAt` stored Stripe `trial_end`. |
| Lifecycle emails disarmed | **Verified, hold kept** | Cron sequence is gated by `LIFECYCLE_EMAILS_ENABLED === 'true'`. Stripe webhook emails are already armed. |

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

Essential SKIP: `cron-lifecycle-production` (`LIFECYCLE_EMAILS_ENABLED` hold).
Non-essential SKIP: `live-stripe-e2e`, `real-mailbox-delivery`.
No FAIL rows.

## Leftovers

1. **`LIFECYCLE_EMAILS_ENABLED` remains off.** Cron first-week sequence will dry-run only until the owner sets the flag after mailbox + delivery verification.
2. **No live Stripe walk.** First charge / trial start in Stripe Checkout was not executed here.
3. **Welcome page does not show `expiresAt`.** It shows the plan label and links to billing. Expiry is on billing + license after the API fix.
4. **Security Review Gate.** `apps/server/src/routes/billing/routes.ts` changed. Merge may need `sec-review:approved` applied by the owner from a raw terminal.
5. **No Merkle root delivery.** Checking a receipt is free; sealed range roots remain Max `auditLog` only and were not implemented here.

## Doors not touched

SSO/#449, Stripe live catalog/keys, license-key migration, Starter Kit checkout, Enterprise unattended checkout. Pro/Max Start trial and Buy CTAs were not hidden or weakened.
