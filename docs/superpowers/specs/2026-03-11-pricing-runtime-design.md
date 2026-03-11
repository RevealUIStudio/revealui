# Design: Move Pricing to Stripe Runtime

**Date:** 2026-03-11
**Source:** MASTER_PLAN §3.8 Step 6
**Status:** Approved

## Goal

Remove dollar amounts from `packages/contracts/src/pricing.ts` (public OSS source) and serve pricing data from a Stripe-backed API endpoint with server-side fallbacks. This ensures pricing is never exposed in source code while keeping all structural data (types, tier names, feature lists, limits, colors, helpers) in contracts.

## Architecture

```
┌─────────────────────┐
│  @revealui/contracts │  Types, tier structure, features, limits, colors
│  (public, no prices) │  SubscriptionTier.price is optional
└──────────┬──────────┘
           │ imported by
           ▼
┌─────────────────────┐     ┌──────────────────┐
│  GET /api/pricing   │────▶│  Stripe Products  │
│  (Hono route)       │     │  API (primary)    │
│                     │     └──────────────────┘
│  Merges structure   │     ┌──────────────────┐
│  + prices           │────▶│  Server-side     │
│                     │     │  fallback prices  │
└──────────┬──────────┘     └──────────────────┘
           │ fetched by (server-side only — no CORS needed)
           ▼
┌─────────────────────┐
│  Marketing page     │  ISR: revalidate every 3600s (React Server Component)
│  CMS billing pages  │  Client-side fetch via existing useEffect pattern
│  PricingTable       │  Renders price or "—" when absent
└─────────────────────┘
```

## Layer 1: Contracts Changes

**File:** `packages/contracts/src/pricing.ts`

### Type Changes

```ts
// Price fields become optional (populated at runtime by /api/pricing)
export interface SubscriptionTier {
  id: LicenseTierId
  name: string
  price?: string          // was required — populated by API
  period?: string
  description: string
  features: string[]
  cta: string
  ctaHref: string
  highlighted: boolean
}

export interface CreditBundle {
  name: string
  tasks: string
  price?: string          // was required
  priceNote?: string      // was required
  costPer?: string        // was required
  description: string
  highlighted: boolean
}

export interface PerpetualTier {
  name: string
  price?: string          // was required
  priceNote?: string      // was required
  renewal?: string        // was required
  description: string
  features: string[]
  cta: string
  ctaHref: string
  comingSoon: boolean
}
```

### New Response Type

```ts
export interface PricingResponse {
  subscriptions: SubscriptionTier[]
  credits: CreditBundle[]
  perpetual: PerpetualTier[]
}
```

Add `type PricingResponse` to the re-exports in `packages/contracts/src/index.ts` (pricing section).

### Static Arrays

Dollar amounts removed from `SUBSCRIPTION_TIERS`, `CREDIT_BUNDLES`, `PERPETUAL_TIERS`. All other fields (name, description, features, cta, ctaHref, highlighted, etc.) remain. The `price`, `priceNote`, `costPer`, and `renewal` fields are omitted (undefined).

### Unchanged

- `LicenseTierId`, `FeatureFlagKey`, `TierLimits`
- `TIER_LABELS`, `TIER_COLORS`, `FEATURE_LABELS`, `TIER_LIMITS`
- `getTiersFromCurrent()`, `getTierLabel()`, `getTierColor()`

## Layer 2: API Endpoint

**File:** `apps/api/src/routes/pricing.ts` (NEW)

### Route

```
GET /api/pricing → PricingResponse
GET /api/v1/pricing → PricingResponse (versioned alias)
```

**Auth:** Public endpoint — no authentication required. Rate-limited by IP.

### Mounting (in `apps/api/src/index.ts`)

```ts
import pricingRoute from './routes/pricing.js'

app.route('/api/pricing', pricingRoute)
app.route('/api/v1/pricing', pricingRoute)

app.use('/api/pricing', routeLimit('pricing'))
app.use('/api/v1/pricing', routeLimit('pricing'))
```

### Logic

1. **Stripe path:** Call `stripe.products.list({ active: true, expand: ['data.default_price'] })`. Each Stripe Product has `metadata.revealui_tier` (e.g., `pro`, `max`, `enterprise`) and `metadata.revealui_track` (e.g., `subscription`, `credit`, `perpetual`). Map prices to the corresponding tier by ID. Format: `unit_amount` (cents) → `$${(unit_amount / 100).toFixed(0)}`. Period from `recurring.interval` → `/month` or `/year`.

2. **Fallback path:** If Stripe is unconfigured (`STRIPE_SECRET_KEY` not set) or the circuit breaker is open, use server-side default prices. These are private constants inside the route file — NOT exported, NOT in contracts.

3. **Merge:** Start with structure from `@revealui/contracts/pricing` (SUBSCRIPTION_TIERS, CREDIT_BUNDLES, PERPETUAL_TIERS), then populate price fields from Stripe or fallback.

4. **Cache:** Response headers: `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`.

### Stripe Client

The pricing route defines its own `getStripeClient()` and `CircuitBreaker` instance inline — do NOT extract from or modify `billing.ts`. The billing route handles real money and must not be touched as part of this change. The 10 lines of Stripe client setup are acceptable duplication to keep the blast radius small.

### Rate Limiting

Add `pricing` to the rate limits config in `apps/api/src/index.ts`:
```ts
'pricing': { maxRequests: 10, windowMs: ONE_MINUTE },
```

10/min is appropriate since the endpoint is public and heavily cached — legitimate clients need at most 1 request per hour.

### OpenAPI Schema

Registered via `@hono/zod-openapi` like other routes.

## Layer 3: Marketing Page (ISR)

**File:** `apps/marketing/src/app/pricing/page.tsx`

### Changes

- Remove direct imports of `SUBSCRIPTION_TIERS`, `CREDIT_BUNDLES`, `PERPETUAL_TIERS`
- Add server-side `fetch()` to `/api/pricing` with `next: { revalidate: 3600 }`
- Use `NEXT_PUBLIC_API_URL` env var for API base URL (already used by CMS; add to `apps/marketing/.env.template` if missing)
- Fallback: if fetch fails, import structure from contracts (prices will be undefined)
- **All rendering must handle optional prices:** render `tier.price ?? 'Contact us'` for subscriptions, `bundle.price ?? '—'` / `bundle.costPer ?? ''` / `bundle.priceNote ?? ''` for credits, and `tier.price ?? '—'` / `tier.priceNote ?? ''` / `tier.renewal ?? '—'` for perpetual tiers

**Important:** The marketing pricing page MUST remain a React Server Component (not `'use client'`). The `fetch()` call is server-to-server (marketing Next.js server → API server), so no CORS configuration is needed.

## Layer 4: CMS Consumers

### Pattern A: PricingTable Component + Users (6 files)

**`packages/presentation/src/components/pricing-table.tsx`:**
- Update the local `PricingTier` interface: `price` becomes `price?: string` (optional)
- Both `PricingCardFull` (line 142) and `PricingCardCompact` (line 225) render `tier.price ?? '—'`

**Callers:** `UpgradeDialog.tsx`, `UpgradePrompt.tsx`, `admin/upgrade/page.tsx`, `CmsLandingPage.tsx`
- These pass `SUBSCRIPTION_TIERS` (now without prices) to `PricingTable`
- PricingTable gracefully shows "—" when price is undefined
- No changes needed in callers beyond what TypeScript already allows (fields are now optional)

### Pattern B: Hardcoded Prices (2 files)

**`apps/cms/src/app/(frontend)/account/billing/page.tsx`:**
- This is a `'use client'` component — do NOT restructure into server/client wrapper
- The page already fetches subscription data via `useEffect` — add a pricing fetch alongside it using the same pattern: `fetch(apiUrl + '/api/pricing')` in the existing `useEffect`
- Remove all 4 hardcoded price strings:
  - Trial expiry message (`$49/month`)
  - Button labels (`$49/mo`, `$149/mo`, `$299/mo`)
- Use `tier.price` + `tier.period` from fetched pricing data, with `?? '—'` fallback

**`apps/cms/src/app/(frontend)/account/license/page.tsx`:**
- Also `'use client'` — same pattern: fetch from `/api/pricing` in existing `useEffect`
- Remove hardcoded `$299`, `$799` from `PERPETUAL_PLANS` constant
- Use fetched pricing data, with `?? '—'` fallback

## Layer 5: Tests

### Updated Tests

1. **`packages/contracts/src/__tests__/pricing.test.ts`**
   - Remove assertions on specific dollar amounts
   - Test that price fields are undefined in static arrays
   - Keep structural assertions (tier count, IDs, features, highlights)

2. **`apps/marketing/src/app/pricing/__tests__/pricing-data.test.ts`**
   - Update to reflect that static arrays no longer contain prices
   - Test structural fields remain populated

3. **`packages/presentation/src/__tests__/pricing-table.test.tsx`**
   - Add test: renders "—" when `price` is undefined
   - Keep existing tests with mock prices

4. **`apps/cms/src/lib/components/__tests__/UpgradeDialog.test.tsx`**
   - Update mock tiers: `price` field becomes optional in mocks

### New Tests

5. **`apps/api/src/routes/__tests__/pricing.test.ts`** (NEW)
   - Test: returns merged pricing data with Stripe prices
   - Test: falls back to server defaults when Stripe unconfigured
   - Test: falls back when circuit breaker is open
   - Test: cache headers are set correctly
   - Test: response matches PricingResponse schema

## Files Changed

| # | File | Action | Risk |
|---|------|--------|------|
| 1 | `packages/contracts/src/pricing.ts` | Remove dollar amounts, optional price fields, add PricingResponse type | Medium — 9 direct importers |
| 2 | `packages/contracts/src/index.ts` | Add PricingResponse to re-exports | Low |
| 3 | `apps/api/src/routes/pricing.ts` | NEW endpoint with own Stripe client + circuit breaker | Low |
| 4 | `apps/api/src/index.ts` | Mount route + rate limit | Low |
| 5 | `apps/marketing/src/app/pricing/page.tsx` | ISR fetch instead of direct import | Medium |
| 6 | `apps/cms/src/app/(frontend)/account/billing/page.tsx` | Remove hardcoded prices, fetch from /api/pricing | Low |
| 7 | `apps/cms/src/app/(frontend)/account/license/page.tsx` | Remove hardcoded prices, fetch from /api/pricing | Low |
| 8 | `apps/cms/src/app/(backend)/admin/upgrade/page.tsx` | Handle optional price (no code change needed) | Low |
| 9 | `apps/cms/src/lib/components/UpgradeDialog.tsx` | Handle optional price (no code change needed) | Low |
| 10 | `apps/cms/src/components/UpgradePrompt.tsx` | Handle optional price (no code change needed) | Low |
| 11 | `apps/cms/src/lib/components/CmsLandingPage.tsx` | Handle optional price (no code change needed) | Low |
| 12 | `packages/presentation/src/components/pricing-table.tsx` | Update PricingTier interface + null-coalesce price renders | Medium |
| 13 | `packages/contracts/src/__tests__/pricing.test.ts` | Update assertions | Low |
| 14 | `apps/marketing/src/app/pricing/__tests__/pricing-data.test.ts` | Update assertions | Low |
| 15 | `packages/presentation/src/__tests__/pricing-table.test.tsx` | Add undefined price test | Low |
| 16 | `apps/cms/src/lib/components/__tests__/UpgradeDialog.test.tsx` | Update mock tier price field | Low |
| 17 | `apps/api/src/routes/__tests__/pricing.test.ts` | NEW test file | Low |

**Not changed (intentionally):**
- `apps/api/src/routes/billing.ts` — handles real money, not touched
- No new shared modules — Stripe client is duplicated (10 lines) to keep billing isolated

## Stripe Product Setup (owner action)

For the Stripe path to work, Products need metadata:

```
Product: "RevealUI Pro"
  metadata.revealui_tier: "pro"
  metadata.revealui_track: "subscription"
  default_price: price_xxx (unit_amount: 4900, recurring: monthly)

Product: "Agent Credits - Standard"
  metadata.revealui_tier: "standard"
  metadata.revealui_track: "credit"
  metadata.revealui_tasks: "60000"
  metadata.revealui_cost_per: "$0.00083/task"
  default_price: price_yyy (unit_amount: 5000, type: one_time)
```

This is an owner action done in the Stripe Dashboard. The API endpoint works without it (fallback prices serve).

## Non-Goals

- No client-side pricing fetch on marketing page (ISR only — no loading spinners)
- No dynamic pricing (prices don't change per-user)
- No currency conversion (USD only for now)
- No Stripe Checkout integration changes (billing routes unchanged)
- No billing.ts refactoring (separate concern, separate PR)
