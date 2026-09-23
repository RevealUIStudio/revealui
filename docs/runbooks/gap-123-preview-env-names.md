---
title: "GAP-123 — Preview env names missing from Vercel"
description: "Owner checklist of production-required env var NAMES that are missing from Vercel preview. Names and targets only."
visibility: internal
status: verified
audience: maintainer
---

# GAP-123 — Preview env names missing from Vercel

Owner checklist of environment variable **names** that hosted production requires and Vercel **preview** does not have (unscoped). Values stay with the owner. This page does not contain secret values.

Observed 2026-09-23 against team `joshuas-projects-c07004e7`, project ids in [`.github/vercel-projects.json`](../../.github/vercel-projects.json). Listing used the Vercel env API with decryption off. Compared **key**, **target**, and **gitBranch** only.

## OWNER

- Set the listed missing **preview** env variable NAMES in Vercel (values you choose; use Stripe test keys where applicable).
- Do not ask the bot to copy prod secret values into preview.
- No promote required for this checklist unless you want main to match.

Preview sync is still production-only (`pnpm vercel:sync` / [`vercel-env-sync.md`](./vercel-env-sync.md)). Adding these names is a dashboard or `vercel env add <NAME> preview` step with a value you choose. Do not run `vercel env pull`. Do not pass `decrypt=true`.

## How a name was classified

Required set:

- `SECRET_PATHS` entries with `requiredInProdHosted: true` in [`scripts/sync/secret-paths.ts`](../../scripts/sync/secret-paths.ts), via each entry's `envVars` and `consumers`
- The hosted boot list `REQUIRED_IN_PRODUCTION_HOSTED` in [`apps/server/src/lib/required-env.ts`](../../apps/server/src/lib/required-env.ts) (the list that flag feeds), applied to **revealui-api**
- `POSTGRES_URL` / `DATABASE_URL` alias group from `REQUIRED_ALWAYS_GROUPS` (either name satisfies API boot)

**Unscoped preview** means `target` includes `preview` and `gitBranch` is empty. That covers preview deployments of any branch, including manual QA deploys.

A `preview` row scoped to git branch `test` or `develop` does **not** cover other preview deployments. Those rows are called out separately.

A single Vercel record whose `target` is both `production` and `preview` is one shared value. For Stripe credentials, split preview onto its own record and set a **test-mode** value.

## Stripe test keys (names only)

| Name | Project | Observed | Owner sets on preview |
| --- | --- | --- | --- |
| `STRIPE_SECRET_KEY` | revealui-api | One record, targets `production` + `preview` | Its own preview record. Stripe **test** secret key (`sk_test_…` or a restricted test key). |
| `STRIPE_SECRET_KEY` | revealui-admin | One record, targets `production` + `preview` | Its own preview record. Stripe **test** secret key. |
| `STRIPE_WEBHOOK_SECRET` | revealui-api | `production` only | Preview record. Stripe **test** webhook signing secret. |
| `STRIPE_WEBHOOK_SECRET` | revealui-admin | One record, targets `production` + `preview` | Its own preview record. Stripe **test** webhook signing secret. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | revealui-admin | `production` only | Preview record. Stripe **test** publishable key (`pk_test_…`). |
| `REVEALUI_BILLING_PORTAL_CONFIG_ID` | revealui-api | `production` only | Preview record when preview billing portal is used. Test-mode portal config id. |

`STRIPE_LIVE_MODE` on revealui-api is `production` only. Leave preview off live mode.

Price id names (`STRIPE_*_PRICE_ID`, `NEXT_PUBLIC_STRIPE_*_PRICE_ID`) are outside the boot-required set. They are production-only on these projects except `STRIPE_MAX_PRICE_ID` and `STRIPE_MAX_ANNUAL_PRICE_ID` on revealui-admin, which already include preview. If preview checkout needs them, set **test-mode** price ids under the same names.

## revealui-api (`prj_zk6EQijYXwd9L7BccuBssi436ktM`)

Already on unscoped preview (no missing-name action): `REVEALUI_ALERT_EMAIL`, `GOOGLE_WIF_PROVIDER`.

`STRIPE_SECRET_KEY` is on preview only as the shared production record. See the Stripe table.

### Missing unscoped preview (name is on production)

Set a preview value you choose. Database and signing material are preview-specific; Stripe rows are test-mode.

- `POSTGRES_URL` (boot also accepts `DATABASE_URL`; both are production-only today — set at least one)
- `DATABASE_URL`
- `REVEALUI_SECRET`
- `REVEALUI_PUBLIC_SERVER_URL`
- `NEXT_PUBLIC_SERVER_URL`
- `STRIPE_WEBHOOK_SECRET` — test webhook signing secret
- `REVEALUI_CRON_SECRET`
- `SENTRY_DSN`
- `REVEALUI_BILLING_PORTAL_CONFIG_ID` — test-mode portal config id
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `REVEALUI_AUDIT_SIGNING_KEY`
- `REVEALUI_API_URL`

### Not in the readable name list (verify before assuming absence)

The api list returned 77 env records. Seven records had **key and target** redacted by the metadata reader (decryption was off; those names were not recovered). `hiddenProductionEnvCount` was 0. These required names were **not** in the readable set, so they may be among those seven or absent entirely:

- `REVEALUI_KEK` (on revealui-admin production; not readable on the api list)
- `CORS_ORIGIN`
- `REVEALUI_LICENSE_PRIVATE_KEY` (boot list still names it; Vercel prod sync no longer ships it to api/admin — mint moved to the license signer, GAP-260)

Verify with names and targets only:

```bash
vercel env ls revealui-api
```

Read the Name and Environments columns. Ignore any Value column.

## revealui-admin (`prj_7sEFDg4MH6C26nJPjrukK86QdwfG`)

Readable list was complete (no redacted keys). Already on unscoped preview: `GOOGLE_WIF_PROVIDER`, `REVEALUI_CRON_SECRET` (shared production+preview record — the name is not missing).

Stripe shared records: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`. See the Stripe table.

### Missing unscoped preview (name is on production)

- `POSTGRES_URL` (`DATABASE_URL` is not on this project)
- `REVEALUI_SECRET`
- `REVEALUI_KEK`
- `REVEALUI_PUBLIC_SERVER_URL`
- `NEXT_PUBLIC_SERVER_URL`
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `REVEALUI_AUDIT_SIGNING_KEY`
- `REVEALUI_API_URL`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — test publishable key

Not on this project at all (api boot names; do not add them here just to mirror api): `DATABASE_URL`, `CORS_ORIGIN`, `SENTRY_DSN`, `REVEALUI_ALERT_EMAIL`, `REVEALUI_BILLING_PORTAL_CONFIG_ID`, `REVEALUI_LICENSE_PRIVATE_KEY`.

## revealui-marketing (`prj_frTIYlnONVPLNIjKnQpINiGb5lm0`)

`requiredInProdHosted` consumer `vercel:marketing` reads `VITE_API_URL` (GAP-350). That name is absent from production and from preview.

Branch-scoped preview only (git branches `test` and `develop`, not unscoped preview): `REVEALUI_API_URL`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_IS_LIVE`. Unscoped preview does not include them.

### Missing unscoped preview

- `VITE_API_URL` — also missing from production; set the preview value you choose

## revealui-docs (`prj_OPwr0FrgcK17AOBCyoj4JIilJ9S1`)

`REVEALUI_API_URL` is on production, and on preview only for git branches `test` and `develop`.

### Missing unscoped preview

- `REVEALUI_API_URL`

## Re-check

```bash
vercel env ls revealui-api
vercel env ls revealui-admin
vercel env ls revealui-marketing
vercel env ls revealui-docs
```

Names and Environments only. A name is covered for all preview deploys when Environments includes Preview and the row is not limited to one git branch.
