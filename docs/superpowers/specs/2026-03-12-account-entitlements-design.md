# Design: Replace License-Centric Gating with Account Entitlements

**Date:** 2026-03-12
**Status:** Proposed
**Source:** 2026-03-12 codebase audit + commercial strategy update

## Goal

Replace the current mixed entitlement model with a single hosted-SaaS authority:

- billing owner is an `account` or `workspace`
- subscriptions and meters attach to that billing owner
- request-time premium access resolves from session -> membership -> account -> entitlements
- deployment or perpetual licenses remain explicit secondary products

## Why This Change Is Required

Current code mixes two incompatible models:

1. Billing stores customer purchases in the database:
   - [apps/api/src/routes/billing.ts](/home/joshua-v-dev/projects/RevealUI/apps/api/src/routes/billing.ts)
   - [apps/api/src/routes/webhooks.ts](/home/joshua-v-dev/projects/RevealUI/apps/api/src/routes/webhooks.ts)
   - [packages/db/src/schema/licenses.ts](/home/joshua-v-dev/projects/RevealUI/packages/db/src/schema/licenses.ts)

2. Premium enforcement reads process-global env-backed license state:
   - [packages/core/src/license.ts](/home/joshua-v-dev/projects/RevealUI/packages/core/src/license.ts)
   - [apps/api/src/middleware/license.ts](/home/joshua-v-dev/projects/RevealUI/apps/api/src/middleware/license.ts)
   - [apps/api/src/index.ts](/home/joshua-v-dev/projects/RevealUI/apps/api/src/index.ts)

That mismatch creates unacceptable behavior:

- a customer can pay and still fail premium gates
- one customer's cached status can affect another because cache is not keyed by billing owner
- feature access is tied to process state instead of request state
- webhook correctness and server-owned catalog control are harder to reason about

## Target Model

### Primary hosted model

Use account-scoped entitlements for SaaS:

```text
session
  -> user
  -> membership
  -> account
  -> subscription
  -> entitlements
  -> feature / quota / billing decision
```

### Secondary models

Keep these separate:

- `deployment licenses` for Forge and similar self-hosted products
- `per-user or perpetual licenses` only for products that are truly sold that way

These should not drive hosted API feature gates.

## Data Model

### New tables

Add the following database objects in `packages/db/src/schema/`:

1. `accounts`
- `id`
- `name`
- `slug`
- `status`
- `createdAt`
- `updatedAt`

2. `account_memberships`
- `id`
- `accountId`
- `userId`
- `role`
- `status`
- `createdAt`
- `updatedAt`

3. `account_subscriptions`
- `id`
- `accountId`
- `stripeCustomerId`
- `stripeSubscriptionId`
- `planId`
- `status`
- `currentPeriodStart`
- `currentPeriodEnd`
- `cancelAtPeriodEnd`
- `createdAt`
- `updatedAt`

4. `account_entitlements`
- `accountId`
- `planId`
- `tier`
- `status`
- `features` JSONB
- `limits` JSONB
- `meteringStatus`
- `graceUntil`
- `updatedAt`

5. `billing_catalog`
- `id`
- `planId`
- `tier`
- `billingModel`
- `stripeProductId`
- `stripePriceId`
- `active`
- `metadata` JSONB
- `createdAt`
- `updatedAt`

6. `usage_meters`
- `id`
- `accountId`
- `meterName`
- `quantity`
- `periodStart`
- `periodEnd`
- `source`
- `idempotencyKey`
- `createdAt`

### Existing tables to keep

Keep these, but reduce their responsibility:

- `users`
- `sessions`
- `licenses`

`licenses` becomes:

- deployment license storage
- perpetual purchase storage
- migration compatibility during rollout

It should stop being the main source of truth for hosted premium access.

## Request-Time Resolution

### New API context

After auth middleware, attach a request-scoped commercial context:

```ts
type EntitlementContext = {
  userId: string
  accountId: string | null
  membershipRole: string | null
  subscriptionStatus: string | null
  tier: 'free' | 'pro' | 'max' | 'enterprise'
  features: Record<string, boolean>
  limits: {
    maxSites?: number
    maxUsers?: number
    maxAgentTasks?: number
  }
}
```

### Resolution rules

1. If request is for Forge or deployment-scoped product:
- use deployment license path

2. Else if request is authenticated and has active membership:
- resolve account entitlements from DB

3. Else:
- resolve free tier

4. Never read hosted feature access from process-global license cache

## Middleware Changes

### Replace current gates for hosted SaaS

Current middleware:
- `requireLicense()`
- `requireFeature()`
- `checkLicenseStatus()`

Problem files:
- [apps/api/src/middleware/license.ts](/home/joshua-v-dev/projects/RevealUI/apps/api/src/middleware/license.ts)
- [packages/core/src/license.ts](/home/joshua-v-dev/projects/RevealUI/packages/core/src/license.ts)

Target:

1. Add `entitlementMiddleware`
- resolves the request's account and entitlements
- caches only within request scope or by `accountId`

2. Replace `requireFeature('ai')` style hosted checks with:
- `requireEntitlementFeature('ai')`

3. Replace quota helpers like `getMaxAgentTasks()` with:
- request-scoped `c.get('entitlements').limits.maxAgentTasks`

4. Keep deployment-license validation only for:
- Forge
- domain-locked self-hosted distributions
- explicit perpetual products

## Billing Flow Changes

### Checkout

Current problem:
- checkout accepts client-supplied `priceId`

Target:

1. Client sends:
- `planId`

2. Server resolves:
- `billing_catalog.planId -> stripePriceId`

3. Server verifies:
- plan active
- expected billing model
- expected product metadata

4. Checkout session metadata includes:
- `accountId`
- `planId`
- `billingModel`

### Webhooks

Current problem:
- event is marked processed before business work fully succeeds

Target:

1. Persist event receipt
2. Transition event state: `received -> processing -> processed`
3. In one durable workflow:
- upsert subscription
- upsert entitlements
- write audit event
- enqueue downstream notifications
4. Mark processed only after durable business state is committed

## Metering Model

Hosted RevealUI should meter business-readable usage:

- `agent_task`
- `workflow_run`
- `tool_call`
- `api_paid_call`
- `commerce_order_completed`
- `gmv_cents`
- `agent_wallet_authorization`

Rules:

- no billing for failed or duplicate execution
- every meter write must be idempotent
- invoices and account usage pages must map usage to business activity, not raw model tokens

## Migration Strategy

### Phase 1: additive schema

- add accounts, memberships, subscriptions, entitlements, billing catalog, usage meters
- do not remove `licenses`

### Phase 2: dual write

- on checkout and webhook success:
  - write current `licenses` record for compatibility
  - write new account subscription and entitlement rows

### Phase 3: dual read

- hosted gates read new entitlements first
- old license path remains only as temporary fallback

### Phase 4: hosted gate cutover

- remove hosted premium routes from `requireLicense()` / `isFeatureEnabled()` process-global dependency

### Phase 5: cleanup

- shrink `licenses` responsibility to deployment and perpetual flows only

## Code Areas Affected

### API

- [apps/api/src/index.ts](/home/joshua-v-dev/projects/RevealUI/apps/api/src/index.ts)
- [apps/api/src/middleware/auth.ts](/home/joshua-v-dev/projects/RevealUI/apps/api/src/middleware/auth.ts)
- [apps/api/src/middleware/license.ts](/home/joshua-v-dev/projects/RevealUI/apps/api/src/middleware/license.ts)
- [apps/api/src/routes/billing.ts](/home/joshua-v-dev/projects/RevealUI/apps/api/src/routes/billing.ts)
- [apps/api/src/routes/webhooks.ts](/home/joshua-v-dev/projects/RevealUI/apps/api/src/routes/webhooks.ts)

### Core

- [packages/core/src/license.ts](/home/joshua-v-dev/projects/RevealUI/packages/core/src/license.ts)
- [packages/core/src/features.ts](/home/joshua-v-dev/projects/RevealUI/packages/core/src/features.ts)

### DB

- [packages/db/src/schema/licenses.ts](/home/joshua-v-dev/projects/RevealUI/packages/db/src/schema/licenses.ts)
- [packages/db/src/schema/users.ts](/home/joshua-v-dev/projects/RevealUI/packages/db/src/schema/users.ts)

### CMS

- account billing pages
- upgrade pages
- any UI that still assumes user-owned license instead of account-owned entitlement

## Acceptance Criteria

This design is complete when:

1. Hosted premium requests no longer depend on process-global env license state
2. Checkout and upgrade flows use server-owned catalog resolution
3. Webhooks durably upsert account subscriptions and entitlements
4. Quotas are enforced from request-scoped account limits
5. `licenses` is no longer the hosted SaaS source of truth
6. Forge and perpetual licenses still work as separate products

## Non-Goals

This change does not by itself:

- redesign marketing pricing UI
- finalize every meter price
- replace Forge licensing
- solve every CI gap

It establishes the billing and entitlement authority that those other pieces can safely build on.
