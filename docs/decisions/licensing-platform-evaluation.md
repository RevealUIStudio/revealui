# Decision: Licensing Platform Evaluation

**Date:** 2026-03-31
**Status:** Decided — keep current implementation
**Phase:** 5 (Agent-First Infrastructure)

## Context

RevealUI uses a custom JWT-based licensing system built in-house. Phase 5 included evaluating whether to migrate to an external licensing platform (Keygen.sh, Anystack, or similar) for Pro/Max/Enterprise tier enforcement.

## Current Implementation

RevealUI's licensing is a dual-model system:

1. **JWT Process-Global (self-hosted deployments)**
   - RS256 JWTs signed with company private key
   - Validated at startup, cached for 5 minutes
   - `initializeLicense()` → `isLicensed('pro')` → `requireFeature('ai')`
   - Supports perpetual (one-time purchase) and subscription licenses

2. **Account Entitlements (hosted SaaS)**
   - Per-account tier + features stored in `account_entitlements` table
   - Request-scoped middleware resolves user → account → entitlements
   - Bridges toward metered billing

3. **Stripe Integration**
   - License keys generated on `checkout.session.completed` webhook
   - Stored in `licenses` table with revocation/expiry tracking
   - DB-backed idempotency for webhook processing

### Key Components
- `packages/core/src/license.ts` — JWT generation/validation, tier caching
- `packages/core/src/features.ts` — Feature flag resolution per tier
- `packages/db/src/schema/accounts.ts` — `licenses`, `account_entitlements` tables
- `apps/api/src/routes/license.ts` — Verify + generate endpoints
- `apps/api/src/middleware/license.ts` — Route guards (requireLicense, requireFeature)
- `apps/api/src/middleware/entitlements.ts` — Account-level entitlement context

## Options Evaluated

### Option A: Keygen.sh
- **Pricing:** $0.05/validation (metered) or $299/mo flat
- **Features:** Machine fingerprinting, offline validation, entitlement management, Stripe integration
- **Pros:** Proven platform, license portability, machine-level activation limits
- **Cons:** External dependency for every license check, $299/mo minimum for production use, vendor lock-in on license format, adds latency to startup validation

### Option B: Anystack
- **Pricing:** From $19/mo (100 licenses) to $99/mo (unlimited)
- **Features:** License key management, Stripe integration, usage analytics
- **Pros:** Lower cost entry, simple API
- **Cons:** Less mature than Keygen.sh, limited offline support, still an external dependency

### Option C: Keep Current Implementation
- **Pricing:** $0 (self-maintained)
- **Features:** Full control, JWT offline validation, Stripe webhook integration, dual enforcement model
- **Pros:** No external dependency, no per-validation cost, offline-first, full control over format/caching/revocation
- **Cons:** Maintenance burden, no machine fingerprinting (not needed for SaaS)

## Decision

**Keep the current custom implementation.** No migration to Keygen.sh or Anystack.

## Rationale

1. **The system works.** JWT signing, Stripe webhook license generation, DB-backed revocation, 5-minute cache — all pre-wired and tested.

2. **No revenue yet.** Adding $299/mo (Keygen) or $19-99/mo (Anystack) before the first paying customer is wrong. The current system has zero marginal cost.

3. **Offline-first is critical.** RevealUI supports BitNet local inference and self-hosted deployments. JWT validation with a cached public key works offline. External platforms require network calls.

4. **The dual model is an advantage.** Self-hosted gets JWT process-global validation (fast, offline). Hosted SaaS gets account-level entitlements (request-scoped, DB-backed). External platforms don't natively support this split.

5. **Machine fingerprinting is unnecessary.** RevealUI is a web application runtime, not desktop software. License enforcement is server-side. There's no "machine" to fingerprint.

6. **Migration cost exceeds benefit.** Changing the license format would break all existing keys. Per the project's no-backwards-compatibility philosophy, this means cutting over all customers at once — high risk for zero proven need.

## When to Reconsider

- If license abuse becomes measurable (shared keys across unauthorized deployments)
- If machine-level activation limits become a product requirement
- If the maintenance burden of the custom system exceeds 10 hours/quarter
- If a licensing platform offers RevealUI-specific value (e.g., npm install gating) at acceptable cost

## Action Items

None — current system is retained as-is. Focus licensing work on:
- Completing account-level metered billing (usage meters → Stripe Billing Meter)
- Adding `kid` claim rotation support for key rollover
- Monitoring for license abuse post-launch
