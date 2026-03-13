# Account Entitlements Migration Plan

> **For agentic workers:** Implement in vertical slices. Do not replace all license code in one PR.

**Goal:** Move hosted RevealUI from license-centric premium gating to account-scoped entitlements without breaking existing billing flows.

**Spec:** [2026-03-12-account-entitlements-design.md](/home/joshua-v-dev/projects/RevealUI/docs/superpowers/specs/2026-03-12-account-entitlements-design.md)

## Phase 0: Stop the highest-risk billing failures

- [ ] Fix webhook processing order in [apps/api/src/routes/webhooks.ts](/home/joshua-v-dev/projects/RevealUI/apps/api/src/routes/webhooks.ts)
- [ ] Remove client-controlled `priceId` trust from [apps/api/src/routes/billing.ts](/home/joshua-v-dev/projects/RevealUI/apps/api/src/routes/billing.ts)
- [ ] Key cached status by billing owner or remove cross-request cache in [apps/api/src/middleware/license.ts](/home/joshua-v-dev/projects/RevealUI/apps/api/src/middleware/license.ts)

## Phase 1: Add the new billing and entitlement schema

- [ ] Add `accounts`
- [ ] Add `account_memberships`
- [ ] Add `account_subscriptions`
- [ ] Add `account_entitlements`
- [ ] Add `billing_catalog`
- [ ] Add `usage_meters`
- [ ] Add migrations and schema tests

## Phase 2: Introduce request-scoped entitlement resolution

- [ ] Add `entitlementMiddleware` in `apps/api/src/middleware/`
- [ ] Resolve `session -> user -> membership -> account -> entitlements`
- [ ] Attach entitlement context to Hono request variables
- [ ] Keep deployment-license path separate for Forge

## Phase 3: Convert hosted route gating

- [ ] Replace hosted `requireFeature()` checks on AI and premium routes
- [ ] Replace hosted `requireLicense()` checks with request-scoped entitlement checks
- [ ] Move quota helpers to entitlement context rather than [packages/core/src/license.ts](/home/joshua-v-dev/projects/RevealUI/packages/core/src/license.ts)

## Phase 4: Convert checkout and upgrades to server-owned catalog resolution

- [ ] Accept `planId` instead of public `priceId`
- [ ] Resolve Stripe product and price IDs from `billing_catalog`
- [ ] Write `accountId` and `planId` into Stripe metadata
- [ ] Add tests for invalid plan, inactive catalog entry, and mismatched metadata

## Phase 5: Convert webhooks to account subscription upserts

- [ ] Create durable webhook event state machine
- [ ] Upsert `account_subscriptions`
- [ ] Upsert `account_entitlements`
- [ ] Keep compatibility writes to `licenses` during transition
- [ ] Add replay and partial-failure tests

## Phase 6: Cut over CMS and billing UI

- [ ] Replace user-license terminology in account billing pages
- [ ] Show account subscription status and entitlement-derived limits
- [ ] Show usage meters in business-readable units

## Phase 7: Remove hosted dependency on legacy license state

- [ ] Remove hosted route dependence on env-backed license cache
- [ ] Retain `licenses` only for deployment/perpetual products
- [ ] Document final separation:
  - hosted SaaS -> account entitlements
  - Forge -> deployment license
  - perpetual products -> explicit license flow

## Required Tests

- [ ] webhook retry after partial failure
- [ ] duplicate webhook idempotency
- [ ] account membership entitlement resolution
- [ ] plan-to-catalog resolution
- [ ] feature gates by account tier
- [ ] quota enforcement by account limits
- [ ] Forge license path unaffected

## Shipping Rule

Do not declare the billing model fixed until:

- hosted premium routes read account entitlements in production paths
- Stripe catalog control is server-owned
- webhook retries are replay-safe
- CI blocks merges on billing and entitlement test failures
