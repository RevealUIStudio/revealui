# Production Checkout Smoke Runbook

**Who:** Owner / on-call operator (founder during initial live phase)
**When:** Immediately after promoting `test → main` to production (post-deploy of any payment-lane change)
**Duration:** ~10 minutes per smoke pass
**Goal:** Confirm a real customer can complete checkout end-to-end and receive an active license. If this smoke passes, the checkout flow is revenue-ready. If it fails partially, you stop before any real customer hits the broken path.

This runbook covers the **per-deploy verification smoke**. For ongoing first-72h monitoring after the initial live flip, see [`stripe-post-flip-72h-monitor.md`](./stripe-post-flip-72h-monitor.md). The two are complementary — this one runs every deploy; the other runs once after `STRIPE_LIVE_MODE=true`.

---

## Pre-flight (gate before running the smoke)

### Required env vars (revvault-sourced — see `~/revfleet/.claude/rules/secrets.md`)

| Purpose | Revvault path | Where it lands |
|---|---|---|
| Stripe live secret key | `revealui/prod/stripe/secret-key` | Vercel `STRIPE_SECRET_KEY` |
| Stripe webhook secret | `revealui/prod/stripe/webhook-secret` | Vercel `STRIPE_WEBHOOK_SECRET` |
| Cron auth secret | `revealui/prod/stripe/cron-secret` | Vercel `REVEALUI_CRON_SECRET` |
| License signing key (Ed25519 PKCS8) | `revealui/prod/license/signing-key` | Vercel `REVEALUI_LICENSE_PRIVATE_KEY` |
| Postgres URL | `revealui/prod/db/postgres-url` | Vercel `DATABASE_URL` |
| Sentry DSN | `revealui/prod/sentry/dsn` | Vercel `SENTRY_DSN` |
| Alert email destination | `revealui/prod/alerts/email` | Vercel `REVEALUI_ALERT_EMAIL` |

> **First-run verify:** the exact revvault path for `cron-secret` follows the canonical convention but should be confirmed against `revvault list revealui/prod/stripe/` on first run. If the path is different, update this table and the post-flip runbook in lockstep.

Confirm each is set in Vercel:

```bash
vercel env ls --environment production | grep -E "STRIPE_|REVEALUI_|SENTRY_DSN|DATABASE_URL"
```

### Required service state

- [ ] Server is running and answering `/health` (post-#796 fix; see `apps/server/src/index.ts:1339-1357` — production branch now binds the listener)
- [ ] Stripe webhook endpoint is registered and pointing at `https://api.revealui.com/api/webhooks` (Stripe Dashboard → Developers → Webhooks)
- [ ] All live Stripe products have `metadata.revealui_tier` set (seeded by `scripts/setup/seed-stripe.ts`; check Stripe Dashboard → Products → any product → Metadata tab)
- [ ] The checkout session creation code sets `metadata.tier` (see Failure Mode #4 — this is a **different** metadata bag from `revealui_tier` above)
- [ ] `pnpm stripe:seed` has run against the **production** Stripe account at least once (idempotent; safe to re-run)
- [ ] `STRIPE_LIVE_MODE=true` is set in Vercel production environment

### Health-check the server

```bash
curl -s https://api.revealui.com/health | jq .
```

> **First-run verify:** confirm the response includes a `stripe_live_mode: true` field (or equivalent). Note the exact field name and update this runbook if it differs. The startup validator at `apps/server/src/lib/validate-startup.ts:237` reads `env.STRIPE_LIVE_MODE === 'true'` — the health endpoint should surface the same boolean.

### DB-backed circuit breaker status

```bash
# Query the breaker table to confirm Stripe API path is CLOSED (= healthy).
# Schema: packages/services/src/stripe/db-circuit-breaker.ts (DB-backed; do
# NOT use the in-memory CircuitBreaker class at packages/resilience/src/
# circuit-breaker.ts — that's a separate implementation used elsewhere).
psql "$DATABASE_URL" -c \
  "SELECT name, state, failure_count, last_failure_at FROM stripe_circuit_breakers ORDER BY name;"
```

Expected: every row has `state = 'closed'` and `failure_count = 0`. If any row is `open`, the smoke will fail at Step 8 — investigate the breaker first before testing checkout.

---

## Customer journey (run as a real signed-in user, real card)

> Use a **real card** in **live mode**. The test card numbers (`4242 4242 4242 4242`) only work in test mode and won't exercise the live webhook path. Use a personal card and refund the charge in §Rollback below.

1. **Sign in** at `https://revealui.com/sign-in` as an account that does NOT currently hold a Pro license (verify in admin: user row's `tier = 'free'`).
2. Navigate to the **pricing page** at `https://revealui.com/pricing`.
3. Click **Get Pro** (the $49/mo subscription tier). 📸 **Screenshot:** the pricing page before clicking, to capture the rendered tier list.
4. The frontend POSTs to the checkout-session creation endpoint, which builds a Stripe checkout session with `metadata = { tier: 'pro', revealui_user_id: <your user id> }` and returns the Stripe-hosted URL. Browser redirects to `https://checkout.stripe.com/...`.
5. **Stripe Checkout (hosted page)** — enter your real card. 📸 **Screenshot:** the Stripe checkout page before submitting (mask the card number — keep last 4 digits visible).
6. Submit. Stripe processes the charge and fires `checkout.session.completed` to your webhook endpoint.
7. Browser redirects back to `https://revealui.com/checkout/success` (the configured `success_url`). 📸 **Screenshot:** the success page.
8. Navigate to `https://app.revealui.com/` (or wherever the post-checkout app lives). Confirm a Pro-gated feature is now accessible (e.g., the AI agents panel that requires `isLicensed('pro')`). 📸 **Screenshot:** the Pro feature rendering.

**Wall-clock budget:** end-to-end (steps 1-8) should complete in **under 30 seconds** on a healthy production. If step 8 doesn't show Pro features within 60 seconds, jump to the failure-mode triage below.

---

## Server-side observability (run in parallel with the customer journey)

### Log lines to grep (Vercel function logs for the server function)

```
# Webhook received (signature OK):
"Stripe webhook received" eventType=checkout.session.completed eventId=evt_...

# License issued:
"License generated" tier=pro customerId=cus_... userId=...

# Subscription row written:
"Subscription created" stripeSubscriptionId=sub_... tier=pro
```

If you see `"Webhook handler error"` or `"resolveTier: missing or unknown tier metadata"` in the same window — jump to the matching failure mode below.

### DB state to verify (run after step 7)

```bash
# 1. Webhook event was recorded as processed
psql "$DATABASE_URL" -c \
  "SELECT id, type, status, created_at FROM webhook_events
   WHERE type = 'checkout.session.completed'
   ORDER BY created_at DESC LIMIT 5;"
# Expected: most recent row has status='processed' and created_at within
# the last 60 seconds.

# 2. License was minted
psql "$DATABASE_URL" -c \
  "SELECT id, tier, revoked_at, created_at FROM licenses
   WHERE customer_id = '<your stripe customer id>'
   ORDER BY created_at DESC LIMIT 5;"
# Expected: most recent row has tier='pro', revoked_at IS NULL.

# 3. Subscription row exists and is active
psql "$DATABASE_URL" -c \
  "SELECT id, stripe_subscription_id, tier, status FROM subscriptions
   WHERE user_id = '<your user id>' ORDER BY created_at DESC LIMIT 5;"
# Expected: most recent row has tier='pro' and status='active'.

# 4. Unreconciled-webhooks queue stayed empty (= no fallback fired)
psql "$DATABASE_URL" -c \
  "SELECT id, event_type, status, created_at FROM unreconciled_webhooks
   WHERE created_at > NOW() - INTERVAL '5 minutes';"
# Expected: zero rows. If a row appears, jump to Failure Mode #7.
```

The schema for these tables lives in `packages/db/src/schema/` (`webhook_events`, `licenses`, `subscriptions`) and `packages/db/src/schema/webhook-reconciliation.ts` (`unreconciled_webhooks`).

### Sentry breadcrumb expectations

Sentry (production environment, last 5 minutes) should show:

- **Zero new fatal/error issues** in the webhook tag
- A breadcrumb chain: `webhook.received` → `license.generated` → `subscription.created`
- No `resolveTier` or `unreconciled` warnings

If new errors appear, the failure mode below names the most likely root cause.

---

## Failure modes (7) — symptom → diagnosis → remediation

### 1. Webhook signature mismatch

- **Symptom:** Stripe Dashboard → Webhooks → Recent deliveries shows `400`. Server logs show `"Webhook signature verification failed"`.
- **Cause:** `STRIPE_WEBHOOK_SECRET` in Vercel doesn't match the secret Stripe is signing with (e.g., the webhook endpoint was rotated in Stripe but Vercel wasn't updated).
- **Fix:** Pull the current signing secret from Stripe Dashboard → Webhooks → your endpoint → Signing secret. Update via revvault: `revvault set revealui/prod/stripe/webhook-secret`. Push to Vercel: `revvault sync vercel`. Redeploy.

### 2. Livemode mismatch

- **Symptom:** Server logs show `"Livemode mismatch — webhook from test mode hit live handler"` (or vice versa). The webhook handler refuses the event with HTTP 400.
- **Cause:** Test-mode events being delivered to the live endpoint, or live events to test endpoint. Usually a misconfigured Stripe webhook endpoint, or the wrong Stripe secret key in Vercel.
- **Fix:** Confirm `STRIPE_SECRET_KEY` in Vercel starts with `sk_live_` (not `sk_test_`). Confirm Stripe Dashboard → Webhooks → your endpoint is in **Live mode** (top-right toggle). The new livemode-guard email alerts (#789, when merged) will fire to `REVEALUI_ALERT_EMAIL` for this case.

### 3. DB circuit breaker open

- **Symptom:** Webhook handler returns 503 with `"Circuit breaker open"`. Stripe Dashboard shows webhook delivery retries.
- **Cause:** Repeated Stripe API failures in the last N minutes tripped the breaker (see `packages/services/src/stripe/db-circuit-breaker.ts` for thresholds + `resetTimeout`).
- **Fix:** Investigate the underlying Stripe API failure first (Stripe status page, your error rate dashboard). Once the upstream is healthy, the breaker auto-resets after `resetTimeout`. To force-reset before then: `UPDATE stripe_circuit_breakers SET state='closed', failure_count=0 WHERE name='<breaker name>';` — but only after confirming Stripe is healthy.

### 4. `resolveTier` ALERT path (session metadata missing `tier`)

- **Symptom:** Server logs show `"resolveTier: missing or unknown tier metadata"` followed by the webhook handler throwing. Customer paid but no license was issued.
- **Cause:** This is the **most-likely-to-bite** failure mode. There are **two distinct metadata bags** in Stripe:
  - **Stripe Product** metadata: `revealui_tier`, `revealui_track`, `revealui_price_note`, `revealui_renewal` — set by `scripts/setup/seed-stripe.ts:466-478` when seeding products.
  - **Stripe Checkout Session** metadata: `tier`, `revealui_user_id`, `github_username` — set by **the checkout-session creation endpoint** when a customer clicks "Get Pro". This is what `resolveTier` (at `apps/server/src/routes/webhooks.ts:193`, called from line 985 perpetual / line 1193 subscription) reads via `session.metadata?.tier`.
- **Fix:** Audit the checkout-session creation endpoint (typically in `apps/server/src/routes/checkout/...` or `apps/admin/...`) and confirm the call to `stripe.checkout.sessions.create({...})` includes `metadata: { tier: 'pro' | 'max' | 'enterprise', revealui_user_id: ... }`. If missing, the server's checkout creation code shipped without that field — needs a code fix, not a config change. Until fixed, every paid checkout will hit this ALERT path.
- **Manual recovery for the customer who already paid:** mint a license manually via the admin (`pnpm cli:license:mint --customer-id=cus_... --tier=pro`) and confirm with them.

### 5. License mint failure

- **Symptom:** Server logs show `"generateLicenseKey: failed"` with a JOSE/Ed25519 error.
- **Cause:** `REVEALUI_LICENSE_PRIVATE_KEY` is malformed, missing, or the wrong key (e.g., test key in prod). License generation lives at `packages/core/src/license.ts:521` — Ed25519 JWT via `jose.SignJWT` with `jose.importPKCS8`.
- **Fix:** Confirm the PKCS8 PEM is valid: `revvault get --full revealui/prod/license/signing-key | head -3` should start with `-----BEGIN PRIVATE KEY-----`. If malformed, regenerate per the license-key rotation runbook (see `docs/SECRETS.md`).

### 6. Stripe API timeout

- **Symptom:** Webhook handler logs show `"Stripe API timeout"` after 30s. Handler returns 5xx; Stripe retries.
- **Cause:** Stripe upstream slow, network blip, or RevealUI server saturated.
- **Fix:** Usually self-heals on Stripe's retry. If repeated, check the DB circuit breaker (Failure Mode #3) — it should be tripping. If breaker is closed but timeouts persist, scale up the server function or check Stripe status page.

### 7. Unreconciled fallback

- **Symptom:** Server logs show the handler returning `200 status='unreconciled'` and `sendWebhookFailureAlert` email arrived. Stripe shows the delivery as `200` (no retry from Stripe). A row appears in the `unreconciled_webhooks` table.
- **Cause:** The handler succeeded at the outer level but failed at the inner reconciliation step (e.g., couldn't write a downstream row). This is the **intentional design** at `apps/server/src/routes/webhooks.ts:3317` — return 200 to acknowledge receipt, queue the event for replay via the `drain-unreconciled` cron, alert the operator immediately.
- **Fix:** The `drain-unreconciled` cron will replay automatically (runs hourly per `vercel.json`). Manual replay: `curl -s -X POST https://api.revealui.com/api/cron/drain-unreconciled -H "X-Cron-Secret: $REVEALUI_CRON_SECRET" | jq .`. Investigate the inner error from the alert email's `Metadata` section — most common cause is a downstream DB schema mismatch.

---

## Success criteria (every box must be ✅)

- [ ] Customer journey steps 1-8 complete in under 30 seconds
- [ ] `/app/` shows the Pro-gated feature rendering correctly post-checkout
- [ ] `webhook_events` row exists with `status='processed'` for the `checkout.session.completed` event
- [ ] `licenses` row exists with `tier='pro'`, `revoked_at IS NULL`, `customer_id = <stripe customer id>`
- [ ] `subscriptions` row exists with `status='active'` and `tier='pro'`
- [ ] `unreconciled_webhooks` table is empty for the last 5 minutes
- [ ] Sentry shows the expected breadcrumb chain, zero new error issues
- [ ] Vercel function logs show the three expected log lines (webhook received, license generated, subscription created)
- [ ] Stripe Dashboard → Recent deliveries shows the webhook delivery as `200`
- [ ] All four screenshots captured (pricing, Stripe checkout, success page, app Pro feature)

If every box is ✅, the production checkout flow is **revenue-ready**.

---

## Rollback (if smoke fails partially)

If the smoke fails after the Stripe charge has gone through (i.e., your card was charged but you didn't get a Pro license, or the license is wrong):

1. **Refund the test charge** — Stripe Dashboard → Payments → find your charge → Refund full. This is the operator's own card; refund is safe.
2. **Void the license (if one was minted with wrong tier or for the wrong user)** — admin UI: Licenses → find the row → Revoke. Or: `UPDATE licenses SET revoked_at = NOW() WHERE id = '<license id>';`
3. **Cancel the subscription (if one was created)** — Stripe Dashboard → Subscriptions → find → Cancel immediately, no proration.
4. **Clean the unreconciled queue (if a row was created)** — `DELETE FROM unreconciled_webhooks WHERE event_id = '<evt_...>';` after confirming the underlying issue is fixed.
5. **If the failure was severe (e.g., resolveTier missing on every checkout)** — set `STRIPE_LIVE_MODE=false` in Vercel and redeploy to stop accepting any new charges until the fix lands. This mirrors the post-flip runbook's escalation step.

---

## When to re-run this smoke

- After every `test → main` promote that touches `apps/server/src/routes/webhooks.ts`, `apps/server/src/routes/checkout/`, `packages/core/src/license.ts`, `packages/services/src/stripe/`, or `scripts/setup/seed-stripe.ts`.
- After any Vercel env var change in the `STRIPE_*` / `REVEALUI_LICENSE_*` / `DATABASE_URL` / `SENTRY_DSN` set.
- After any Stripe Dashboard change to webhook endpoints, products, or prices.
- Once a week at minimum during the launch window (first 30 days post-flip).

---

*Runbook created 2026-05-10 as part of the overnight launch convergence push. Pairs with [`stripe-post-flip-72h-monitor.md`](./stripe-post-flip-72h-monitor.md) (which covers ongoing first-72h monitoring after `STRIPE_LIVE_MODE=true`). Audit-first SDLC: every file:line citation in this runbook was grep-confirmed against `origin/test` HEAD `78387802a` before commit; the `metadata.tier` vs `metadata.revealui_tier` distinction at Failure Mode #4 was surfaced by verify-twice and is documented as the most-likely-to-bite failure mode.*
