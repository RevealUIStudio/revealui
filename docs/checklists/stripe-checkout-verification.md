# Stripe Checkout Verification Checklist

Complete each flow end-to-end in **test mode** before switching to live keys.
Use Stripe test card: `4242 4242 4242 4242` (any future expiry, any CVC).

## Prerequisites

- [ ] API running (`pnpm dev:api`)
- [ ] CMS running (`pnpm dev:cms`)
- [ ] Signed in as a test user in CMS
- [ ] Stripe test mode keys in vault (`sk_test_*`, `whsec_*`)
- [ ] Stripe CLI forwarding webhooks: `stripe listen --forward-to localhost:3004/api/webhooks/stripe`

---

## 1. Subscription Checkout

### 1a. Pro subscription ($49/mo)
- [ ] Navigate to CMS → Account → Billing (or pricing page)
- [ ] Click subscribe to Pro
- [ ] Verify: redirects to Stripe Checkout with correct amount ($49/mo)
- [ ] Verify: 7-day trial shown (if REVEALUI_TRIAL_DAYS=7)
- [ ] Complete payment with test card
- [ ] Verify: redirected to `/account/billing?success=true`
- [ ] Verify: `checkout.session.completed` webhook received (check Stripe CLI output)
- [ ] Verify: license created in DB (`SELECT * FROM licenses WHERE user_id = ...`)
- [ ] Verify: user tier shows "pro" in CMS dashboard

### 1b. Max subscription ($149/mo)
- [ ] Same flow as 1a but for Max tier
- [ ] Verify correct amount ($149/mo)
- [ ] Verify license tier = "max"

### 1c. Enterprise subscription ($299/mo)
- [ ] Same flow as 1a but for Enterprise tier
- [ ] Verify correct amount ($299/mo)
- [ ] Verify license tier = "enterprise"

---

## 2. Perpetual License Checkout

### 2a. Pro perpetual ($299 one-time)
- [ ] Hit `POST /api/billing/checkout-perpetual` with `{"tier":"pro"}`
- [ ] Complete Stripe Checkout with test card
- [ ] Verify: `checkout.session.completed` webhook received
- [ ] Verify: license created with `perpetual = true`
- [ ] Verify: `support_expires_at` set to 1 year from now

### 2b. Max perpetual ($799 one-time)
- [ ] Same flow, tier = "max"

### 2c. Enterprise perpetual ($1,999 one-time)
- [ ] Same flow, tier = "enterprise"

### 2d. Perpetual with GitHub username
- [ ] Hit endpoint with `{"tier":"pro","githubUsername":"testuser"}`
- [ ] Verify: `github_username` stored on license record

---

## 3. Agent Credits Checkout

### 3a. Starter bundle (10,000 tasks @ $10)
- [ ] Hit `POST /api/billing/checkout-credits` with `{"bundle":"starter"}`
- [ ] Complete payment
- [ ] Verify: `agent_credit_balance` incremented by 10,000
- [ ] Verify: redirected to `/account/billing?credits=starter`

### 3b. Standard bundle (60,000 tasks @ $50)
- [ ] Same flow, bundle = "standard"
- [ ] Verify: balance incremented by 60,000

### 3c. Scale bundle (350,000 tasks @ $250)
- [ ] Same flow, bundle = "scale"
- [ ] Verify: balance incremented by 350,000

### 3d. Credits stack
- [ ] Purchase a second bundle
- [ ] Verify: credits ADD to existing balance (not replace)

---

## 4. Billing Portal

- [ ] Hit `POST /api/billing/portal`
- [ ] Verify: returns valid Stripe portal URL
- [ ] Open URL in browser
- [ ] Verify: shows subscription details, payment method, invoices
- [ ] Verify: return URL goes to `/account/billing`

---

## 5. Subscription Upgrade

- [ ] Start with an active Pro subscription (from step 1a)
- [ ] Hit `POST /api/billing/upgrade` with `{"targetTier":"max"}`
- [ ] Verify: `customer.subscription.updated` webhook received
- [ ] Verify: license tier updated to "max"
- [ ] Verify: proration created in Stripe
- [ ] Verify: `pending_change` flag cleared after webhook

### 5a. Reject invalid upgrades
- [ ] Try upgrading enterprise → pro: expect 400
- [ ] Try upgrading with no subscription: expect 400
- [ ] Try upgrading while `pending_change` is set: expect 409

---

## 6. Subscription Downgrade (Cancel)

- [ ] Start with an active subscription
- [ ] Hit `POST /api/billing/downgrade`
- [ ] Verify: returns `effectiveAt` (end of billing period)
- [ ] Verify: Stripe shows `cancel_at_period_end: true`
- [ ] Verify: user retains Pro access until `effectiveAt`
- [ ] Verify: `customer.subscription.deleted` webhook fires at period end

### 6a. Reject invalid downgrades
- [ ] Try downgrading with no subscription: expect 400
- [ ] Try downgrading while `pending_change` is set: expect 409

---

## 7. Webhook Lifecycle

### 7a. Payment failure → Grace period → Suspension
- [ ] Use Stripe test card `4000 0000 0000 0341` (always declines)
- [ ] Verify: `invoice.payment_failed` webhook received
- [ ] Verify: grace period applied (1-2 failures)
- [ ] Verify: suspension on 3+ failures
- [ ] Verify: recovery email sent

### 7b. Dispute (chargeback)
- [ ] Create test dispute in Stripe Dashboard
- [ ] Verify: `charge.dispute.created` webhook received
- [ ] Verify: license NOT revoked (just logged)
- [ ] Close dispute as won → verify license restored
- [ ] Close dispute as lost → verify license revoked

### 7c. Refund
- [ ] Issue full refund in Stripe Dashboard
- [ ] Verify: `charge.refunded` webhook received
- [ ] Verify: license revoked

### 7d. Trial ending
- [ ] Create subscription with trial
- [ ] Verify: `customer.subscription.trial_will_end` fires 3 days before end
- [ ] Verify: reminder email sent

---

## 8. RVUI Payment (Disabled)

- [ ] Hit `POST /api/billing/rvui-payment`
- [ ] Verify: returns 501 "RVUI payment is not yet available"

---

## 9. Edge Cases

- [ ] Duplicate subscription prevention: try checkout when already subscribed
- [ ] Duplicate perpetual prevention: try perpetual checkout when already purchased
- [ ] Missing `CMS_URL` env var: verify 500 with clear error
- [ ] Expired session cookie: verify 401 on all endpoints
- [ ] Rate limiting: hit checkout 11 times rapidly, verify 429

---

## Sign-off

| Flow | Verified By | Date |
|------|------------|------|
| Subscription (pro/max/enterprise) | | |
| Perpetual (pro/max/enterprise) | | |
| Credits (starter/standard/scale) | | |
| Portal | | |
| Upgrade | | |
| Downgrade | | |
| Webhooks (failure/dispute/refund/trial) | | |
| RVUI disabled | | |
| Edge cases | | |

**All flows verified → safe to switch `STRIPE_SECRET_KEY` to live.**
