---
title: "Stripe Post-Flip 72h Monitor Runbook"
description: "**Who:** On-call operator (founder during initial live phase)"
visibility: internal
status: verified
audience: maintainer
---

# Stripe Post-Flip 72h Monitor Runbook

**Who:** On-call operator (founder during initial live phase)
**When:** Immediately after setting `STRIPE_LIVE_MODE=true` and deploying to production
**Duration:** First 72 hours of live-mode operation
**Goal:** Confirm every real-money path produces the expected signals; catch any silent failure within minutes rather than days

---

## Pre-requisites (gate before flipping)

Before starting this runbook, confirm:

- [ ] `SENTRY_DSN` is set in the Vercel production environment and appears in `REQUIRED_IN_PRODUCTION_HOSTED` (validated at boot by `apps/server/src/lib/validate-startup.ts`)
- [ ] `REVEALUI_ALERT_EMAIL` is set and routes to a monitored mailbox
- [ ] At least one test transaction completed successfully in Stripe test mode (full checkout → license issuance → customer portal)
- [ ] The billing-readiness cron (`/api/cron/billing-readiness`) returned `status: ok` within the last 24h
- [ ] Stripe webhook endpoint is registered and receiving events (verify in Stripe Dashboard → Developers → Webhooks)

---

## Alert wiring (as of Phase 1 audit fix — J-P0-1 / J-P0-2)

All critical cron failures now route through `sendCronFailureAlert` (implemented in `apps/server/src/lib/cron-alerts.ts`). This function:

1. **Always logs** at the configured severity via `@revealui/core/observability/logger` (visible in Vercel function logs)
2. **Captures to Sentry** via `Sentry.captureException` when `SENTRY_DSN` is set — tagged with `cron_job` and `alert_severity`
3. **Sends email** to `REVEALUI_ALERT_EMAIL` with structured subject `[CRON FAILURE] <jobName>: <error.message>`

The five reconciliation crons now call `sendCronFailureAlert` on critical failures:

| Cron | File | Alert trigger |
|------|------|---------------|
| `reconcile-subscriptions` | `apps/server/src/routes/cron/reconcile-subscriptions.ts` | `missing-in-stripe` drift; `status-mismatch` that ends entitlement |
| `drain-unreconciled` | `apps/server/src/routes/cron/drain-unreconciled.ts` | Event unresolved >24h and replay failed |
| `reconcile-customers` | `apps/server/src/routes/cron/reconcile-customers.ts` | Newly-detected orphaned Stripe customer |
| `marketplace-payouts` | `apps/server/src/routes/cron/marketplace-payouts.ts` | Individual transfer failure; outer cron crash |
| `billing-readiness` | `apps/server/src/routes/cron/billing-readiness.ts` | Any check failure |

**Important:** `sendCronFailureAlert` is additive — it runs alongside the existing `logger.error` call and never replaces it. Vercel function logs are always populated regardless of whether Sentry or email delivery succeeds.

---

## Hour 0–4: Immediately post-flip

### 1. Confirm Sentry is receiving events

Trigger a synthetic error by hitting an authenticated route with a deliberately malformed payload and checking Sentry for the capture:

```bash
# Confirm the server is up and Sentry is initialised (look for DSN in startup log)
curl -s https://api.revealui.com/health | jq .

# Check Sentry project for any boot-time issues
# Sentry Dashboard → Issues → filter by environment:production, last 1h
```

Sentry should show at least one event from the server startup within the first deploy. If the Issues list is completely empty after 30 minutes, verify `SENTRY_DSN` is set correctly and the Vercel deployment picked it up (`vercel env ls --environment production`).

### 2. Confirm webhook endpoint is live

```bash
# Stripe CLI — forward events and confirm revealui's handler returns 200
stripe listen --forward-to https://api.revealui.com/api/webhooks
```

Or verify in Stripe Dashboard: Developers → Webhooks → your endpoint → Recent deliveries. Every delivery should show `200` status. Any `4xx`/`5xx` means the handler is broken.

### 3. Confirm billing-readiness cron passes

Trigger manually:

```bash
curl -s -X POST https://api.revealui.com/api/cron/billing-readiness \
  -H "X-Cron-Secret: $REVEALUI_CRON_SECRET" | jq .status
# Expected: "ok"
```

If `status: failed`, check the `failures` array in the response. Common causes: missing Stripe price IDs, missing `billing_catalog` DB rows, Stripe key mismatch. Fix before accepting real traffic.

---

## Hour 4–24: First real-transaction window

### 4. Watch reconciliation crons

The reconciliation crons run on Vercel's cron schedule (see `vercel.json`). During the first 24h, manually trigger each one and confirm clean output:

```bash
# reconcile-subscriptions
curl -s -X POST https://api.revealui.com/api/cron/reconcile-subscriptions \
  -H "X-Cron-Secret: $REVEALUI_CRON_SECRET" | jq '{scanned, drift, critical}'
# Expected: critical: 0

# drain-unreconciled
curl -s -X POST https://api.revealui.com/api/cron/drain-unreconciled \
  -H "X-Cron-Secret: $REVEALUI_CRON_SECRET" | jq '{scanned, replayed, critical}'
# Expected: critical: 0 (or 0 scanned if queue is empty)

# reconcile-customers
curl -s -X POST https://api.revealui.com/api/cron/reconcile-customers \
  -H "X-Cron-Secret: $REVEALUI_CRON_SECRET" | jq '{scanned, orphaned, alerted}'
# Expected: alerted: 0
```

**If `critical > 0`:** you will have already received an alert email and a Sentry event via `sendCronFailureAlert`. Check those for the specific account IDs / event IDs and investigate in Stripe Dashboard before the customer notices.

### 5. Monitor alert email inbox

Check `REVEALUI_ALERT_EMAIL` inbox. Expected subject patterns that indicate real problems:

- `[CRON FAILURE] reconcile-subscriptions: CRITICAL: missing-in-stripe for account ...` — a customer's subscription exists in our DB but not in Stripe. Manual fix required.
- `[CRON FAILURE] drain-unreconciled: CRITICAL: event ... unresolved >24h and replay failed` — a webhook event is stuck. Investigate the `unreconciledWebhooks` table.
- `[CRON FAILURE] reconcile-customers: CRITICAL: orphaned Stripe customer ...` — Stripe customer with no local row. Check if checkout completed without webhook delivery.
- `[CRON FAILURE] marketplace-payouts: ...` — a Stripe Connect transfer failed.
- `[CRITICAL] RevealUI: Webhook handler crashed — checkout.session.completed` — sent by `sendWebhookFailureAlert` (separate from the cron alerts); means a customer paid but may not have received their license. **Act within 1 hour.**

---

## Hour 24–72: Steady-state monitoring

### 6. Check Sentry error volume

Sentry Dashboard → Performance and Issues. Acceptable error volume in the first 72h:

- `0` fatal issues
- `< 5` distinct error types (mostly expected: 4xx client errors, occasional Stripe network hiccup)

If you see payment-path errors clustering (e.g., multiple `checkout.session.completed` failures), the webhook handler has a bug. Take the site to maintenance mode (`STRIPE_LIVE_MODE=false` redeploy) rather than letting customers hit broken checkout.

### 7. Confirm no silent cron drift

After 72h, run the reconciliation suite one more time and confirm `critical: 0` across all three crons. If `drain-unreconciled` shows `critical > 0`, at least one webhook event has been stuck for >24h — investigate before the 72h window closes.

---

## Verifying alerts work (smoke test)

To confirm `sendCronFailureAlert` is wired end-to-end before a real incident:

```bash
# 1. Trigger a synthetic billing-readiness failure by temporarily removing a
#    required env var in a preview deployment (NOT production):
#    Remove STRIPE_PRO_PRICE_ID from the preview environment.

# 2. Trigger the cron in the preview deployment:
curl -s -X POST https://<preview-url>/api/cron/billing-readiness \
  -H "X-Cron-Secret: $REVEALUI_CRON_SECRET" | jq .

# 3. Confirm within 2 minutes:
#    a. REVEALUI_ALERT_EMAIL inbox has a message with subject
#       "[CRON FAILURE] billing-readiness: Billing readiness check failed: ..."
#    b. Sentry shows a new issue tagged cron_job=billing-readiness
#    c. Vercel function logs show the logger.error line

# 4. Restore the env var before the preview deployment is used for anything else.
```

This smoke test validates all three legs of `sendCronFailureAlert` (log → Sentry → email) without touching production.

---

## Escalation

If any critical alert fires and you cannot identify the root cause within 30 minutes:

1. Set `STRIPE_LIVE_MODE=false` and redeploy — this stops new live charges while you investigate
2. Check Stripe Dashboard → Events for any failed charges or webhook delivery failures in the last hour
3. Check `unreconciledWebhooks` table for new rows
4. Open a GitHub issue in `RevealUIStudio/revealui` tagged `severity:critical billing`

---

*Runbook created 2026-05-09 as part of Phase 1 audit P0 fix (J-P0-3). Alert wiring (J-P0-1 / J-P0-2) implemented in the same PR.*
