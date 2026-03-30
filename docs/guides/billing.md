# Billing

RevealUI integrates with Stripe for checkout, subscriptions, and billing portal. The billing system uses account-level subscriptions with metered usage for AI and agent features.

**API routes:** `apps/api/src/routes/billing.ts`, `apps/api/src/routes/webhooks.ts`

---

## Pricing Tiers

RevealUI defines four pricing tiers:

| Tier | Code | Sites | Users | Rate Limit |
|------|------|-------|-------|------------|
| Free | `free` | 1 | 3 | 200 req/min |
| Pro | `pro` | 5 | 25 | 300 req/min |
| Max | `max` | 15 | 100 | 600 req/min |
| Enterprise (Forge) | `enterprise` | Unlimited | Unlimited | Custom |

Tier definitions and feature flags live in `@revealui/contracts`. Dollar amounts are **not hardcoded** -- they are fetched at runtime from the Stripe Products API via `GET /api/pricing`, with fallback values used when Stripe is unavailable.

### Feature Gating

```ts
import { isLicensed } from '@revealui/core';
import { isFeatureEnabled } from '@revealui/core/features';

// Check tier
if (isLicensed('pro')) {
  // Pro features available
}

// Check specific feature
if (isFeatureEnabled('ai')) {
  // AI features enabled
}
```

---

## Setup

### Prerequisites

- Stripe account ([dashboard.stripe.com](https://dashboard.stripe.com))
- Stripe CLI (for local webhook testing)

### Environment Variables

```env
# Stripe API keys (use test keys for development)
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Webhook signing secret
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Creating Stripe Products

Create products and prices in the Stripe dashboard that match your tier structure:

1. Go to **Products** in the Stripe dashboard
2. Create a product for each tier (Pro, Max, Forge)
3. Add a recurring price to each product
4. Note the price IDs -- these are returned by the pricing API

The `GET /api/pricing` endpoint reads products from Stripe and maps them to RevealUI tiers. If Stripe is unavailable, hardcoded fallback prices are used.

---

## Checkout Flow

### Creating a Checkout Session

The billing API creates Stripe Checkout sessions for upgrading:

```ts
// Client-side: redirect to Stripe Checkout
async function handleUpgrade(tier: 'pro' | 'max' | 'enterprise') {
  const response = await fetch('/api/billing/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tier }),
    credentials: 'include', // Send session cookie
  });

  const { url } = await response.json();
  window.location.href = url; // Redirect to Stripe Checkout
}
```

### Checkout API

```
POST /api/billing/checkout
```

Request body:

```json
{
  "tier": "pro"
}
```

Response:

```json
{
  "url": "https://checkout.stripe.com/c/pay/cs_test_..."
}
```

The endpoint:

1. Validates the user session
2. Finds or creates a Stripe customer (linked via `stripe_customer_id` in the users table)
3. Creates a Checkout Session with the correct price
4. Returns the Checkout URL

### Success and Cancel URLs

After checkout, Stripe redirects the user back to your app:

- **Success:** `/account/billing?status=success`
- **Cancel:** `/account/billing?status=cancelled`

The actual subscription activation happens asynchronously via webhooks, not on the success redirect.

---

## Webhooks

Stripe webhooks handle subscription lifecycle events. The webhook handler lives at `POST /api/webhooks/stripe`.

### Handled Events

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Create subscription record, set entitlements |
| `customer.subscription.updated` | Update tier, sync entitlements |
| `customer.subscription.deleted` | Revoke entitlements, downgrade to free |
| `invoice.payment_succeeded` | Record payment, extend subscription |
| `invoice.payment_failed` | Mark subscription past due |

### Webhook Verification

Every webhook request is verified using the `STRIPE_WEBHOOK_SECRET`:

```ts
const event = stripe.webhooks.constructEvent(
  rawBody,
  signature,
  process.env.STRIPE_WEBHOOK_SECRET,
);
```

Unverified requests are rejected with HTTP 400.

### Idempotency

Webhook processing is idempotent. Each event ID is recorded in the `processed_webhook_events` table. If the same event is received twice (which Stripe does for reliability), the duplicate is skipped.

### Local Testing

Use the Stripe CLI to forward webhook events to your local server:

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward events to local webhook endpoint
stripe listen --forward-to localhost:3004/api/webhooks/stripe
```

The CLI prints a webhook signing secret (`whsec_...`). Set it as `STRIPE_WEBHOOK_SECRET` in your `.env.development.local`.

### Triggering Test Events

```bash
# Trigger a checkout completion
stripe trigger checkout.session.completed

# Trigger a subscription update
stripe trigger customer.subscription.updated

# Trigger a payment failure
stripe trigger invoice.payment_failed
```

---

## Billing Portal

The Stripe Customer Portal lets users manage their subscription, update payment methods, and view invoices.

```ts
// Create a portal session
async function openBillingPortal() {
  const response = await fetch('/api/billing/portal', {
    method: 'POST',
    credentials: 'include',
  });

  const { url } = await response.json();
  window.location.href = url;
}
```

The portal session is created with:

```
POST /api/billing/portal
```

Response:

```json
{
  "url": "https://billing.stripe.com/p/session/..."
}
```

Configure the Customer Portal in the Stripe dashboard under **Settings > Customer Portal** to control which actions users can perform (cancel, switch plans, update payment method).

---

## Subscription Status

Query the current user's subscription status:

```
GET /api/billing/status
```

Response:

```json
{
  "tier": "pro",
  "status": "active",
  "currentPeriodEnd": "2026-04-15T00:00:00Z",
  "cancelAtPeriodEnd": false,
  "limits": {
    "maxSites": 5,
    "maxUsers": 25,
    "rateLimit": 300
  }
}
```

### Account Entitlements

Subscriptions are modeled as account-level entitlements, not per-user licenses. When a user subscribes, entitlements are written to the `account_entitlements` table and linked to their account via `account_subscriptions`.

```ts
import { getClient } from '@revealui/db';
import { accountEntitlements } from '@revealui/db/schema';
import { eq } from 'drizzle-orm';

const db = getClient();
const entitlements = await db
  .select()
  .from(accountEntitlements)
  .where(eq(accountEntitlements.accountId, accountId));
```

---

## Circuit Breaker

All Stripe API calls go through a circuit breaker to handle Stripe outages gracefully. If Stripe is unreachable (5 consecutive failures), the circuit opens and subsequent requests immediately return HTTP 503 with:

```json
{
  "message": "Payment service temporarily unavailable. Please try again shortly."
}
```

The circuit resets after 30 seconds and requires 2 successful calls before fully closing.

---

## Pricing API

The pricing endpoint serves tier information and prices to the frontend:

```
GET /api/pricing
```

Response:

```json
{
  "tiers": [
    {
      "id": "free",
      "name": "Free",
      "features": ["1 site", "3 users", "200 req/min"],
      "price": "$0"
    },
    {
      "id": "pro",
      "name": "Pro",
      "features": ["5 sites", "25 users", "300 req/min", "AI agents"],
      "price": "$49/mo"
    }
  ]
}
```

Prices are fetched from Stripe Products API and cached with `Cache-Control: s-maxage=3600, stale-while-revalidate=86400`.

When rendering prices in the UI, always handle the case where a price is `undefined`:

```tsx
<span>{tier.price ?? '--'}</span>
```

---

## Database Tables

The billing system uses these NeonDB tables:

| Table | Purpose |
|-------|---------|
| `users` | `stripe_customer_id` column links to Stripe |
| `accounts` | Account/workspace that owns subscriptions |
| `account_subscriptions` | Active subscription records |
| `account_entitlements` | Feature entitlements per account |
| `account_memberships` | Users belonging to an account |
| `licenses` | Legacy per-user license keys |
| `billing_catalog` | Cached product/price catalog |
| `agent_task_usage` | Metered AI usage tracking |
| `processed_webhook_events` | Webhook idempotency records |

---

## Production Checklist

- [ ] Switch from test keys (`sk_test_`) to live keys (`sk_live_`)
- [ ] Register the webhook endpoint in Stripe dashboard (not just CLI)
- [ ] Configure the Customer Portal in Stripe settings
- [ ] Create products and prices in Stripe that match your tiers
- [ ] Verify webhook signature validation is working
- [ ] Set `STRIPE_WEBHOOK_SECRET` to the production webhook secret (not the CLI one)
- [ ] Test the full flow: checkout, payment, webhook, entitlement activation

---

## Related Documentation

- [Build Your Business](../BUILD_YOUR_BUSINESS.md) -- End-to-end product setup
- [Pro Features](../PRO.md) -- AI, MCP, and commercial features
- [Environment Variables](../ENVIRONMENT_VARIABLES_GUIDE.md) -- Full configuration reference
