# Pricing Runtime Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove dollar amounts from public source code and serve pricing via a Stripe-backed API endpoint with server-side fallbacks.

**Strategic update (2026-03-12):** This runtime-pricing work remains useful, but it is not the end-state pricing model. RevealUI's target commercial architecture is account/workspace billing plus metered agent execution, explicit commerce fees, and premium trust/governance controls. Public pricing should eventually be rendered from server-owned plans and meters, not from client-supplied Stripe price IDs or per-user license assumptions.

**Architecture:** Contracts keeps types + tier structure (no prices). New `GET /api/pricing` Hono route merges structure from contracts with prices from Stripe (or server-side fallback). Marketing page fetches via ISR; CMS client pages fetch via existing `useEffect` pattern. PricingTable renders "—" when price is undefined.

**Important commercial constraint:** Pricing presentation and billing authority are different concerns. A runtime pricing endpoint can publish public prices, but billing authority must live in server-owned catalog resolution, request-scoped entitlements, and replay-safe metering.

**Tech Stack:** TypeScript, Hono, Stripe SDK, Next.js ISR, Vitest, @hono/zod-openapi

**Spec:** `docs/superpowers/specs/2026-03-11-pricing-runtime-design.md`

---

## Chunk 1: Contracts + PricingTable (foundation)

### Task 1: Make price fields optional in contracts types

**Files:**

- Modify: `packages/contracts/src/pricing.ts:102-112` (SubscriptionTier)
- Modify: `packages/contracts/src/pricing.ts:208-216` (CreditBundle)
- Modify: `packages/contracts/src/pricing.ts:252-262` (PerpetualTier)

- [ ] **Step 1: Update SubscriptionTier interface — make `price` optional**

In `packages/contracts/src/pricing.ts`, change line 105:

```ts
// Before:
  price: string
// After:
  price?: string
```

- [ ] **Step 2: Update CreditBundle interface — make `price`, `priceNote`, `costPer` optional**

In `packages/contracts/src/pricing.ts`, change lines 211-213:

```ts
// Before:
  price: string
  priceNote: string
  costPer: string
// After:
  price?: string
  priceNote?: string
  costPer?: string
```

- [ ] **Step 3: Update PerpetualTier interface — make `price`, `priceNote`, `renewal` optional**

In `packages/contracts/src/pricing.ts`, change lines 254-256:

```ts
// Before:
  price: string
  priceNote: string
  renewal: string
// After:
  price?: string
  priceNote?: string
  renewal?: string
```

- [ ] **Step 4: Add PricingResponse type**

After the `PerpetualTier` interface (after line 262), add:

```ts
// =============================================================================
// Pricing API Response
// =============================================================================

export interface PricingResponse {
  subscriptions: SubscriptionTier[];
  credits: CreditBundle[];
  perpetual: PerpetualTier[];
}
```

- [ ] **Step 5: Remove dollar amounts from SUBSCRIPTION_TIERS**

Remove the `price` and `period` fields from each entry in the `SUBSCRIPTION_TIERS` array (lines 114-202). Keep all other fields. The entries should look like:

```ts
{
  id: 'free',
  name: 'Free (OSS)',
  description: 'Perfect for trying out RevealUI and small projects.',
  features: [ /* unchanged */ ],
  cta: 'Get Started',
  ctaHref: 'https://docs.revealui.com',
  highlighted: false,
},
{
  id: 'pro',
  name: 'Pro',
  description: 'For software companies building production products.',
  features: [ /* unchanged */ ],
  cta: 'Start Free Trial',
  ctaHref: '/signup?plan=pro',
  highlighted: true,
},
// ... same for max and enterprise
```

- [ ] **Step 6: Remove dollar amounts from CREDIT_BUNDLES**

Remove `price`, `priceNote`, and `costPer` from each entry in `CREDIT_BUNDLES` (lines 218-246). Keep `name`, `tasks`, `description`, `highlighted`.

- [ ] **Step 7: Remove dollar amounts from PERPETUAL_TIERS**

Remove `price`, `priceNote`, and `renewal` from each entry in `PERPETUAL_TIERS` (lines 264-318). Keep `name`, `description`, `features`, `cta`, `ctaHref`, `comingSoon`.

- [ ] **Step 8: Add PricingResponse to contracts re-exports**

In `packages/contracts/src/index.ts`, add `type PricingResponse` to the pricing re-exports (after line 498):

```ts
export {
  CREDIT_BUNDLES,
  type CreditBundle,
  FEATURE_LABELS,
  type FeatureFlagKey,
  getTierColor,
  getTierLabel,
  getTiersFromCurrent,
  type LicenseTierId,
  PERPETUAL_TIERS,
  type PerpetualTier,
  type PricingResponse, // ADD THIS
  SUBSCRIPTION_TIERS,
  type SubscriptionTier,
  TIER_COLORS,
  TIER_LABELS,
  TIER_LIMITS,
  type TierLimits,
} from "./pricing.js";
```

- [ ] **Step 9: Run typecheck on contracts**

Run: `pnpm --filter @revealui/contracts typecheck`
Expected: PASS (the type widening is backwards-compatible for type imports; compile errors in consumers that destructure `.price` are expected and will be fixed in later tasks)

- [ ] **Step 10: Commit**

```bash
git add packages/contracts/src/pricing.ts packages/contracts/src/index.ts
git commit -m "refactor(contracts): make pricing fields optional, remove dollar amounts

Dollar amounts removed from SUBSCRIPTION_TIERS, CREDIT_BUNDLES, and
PERPETUAL_TIERS. Price fields are now optional on SubscriptionTier,
CreditBundle, and PerpetualTier. Prices will be populated at runtime
by GET /api/pricing (Stripe-backed with server-side fallback).

Adds PricingResponse type for the API response shape.

Part of MASTER_PLAN §3.8 Step 6."
```

---

### Task 2: Update PricingTable to handle optional prices

**Files:**

- Modify: `packages/presentation/src/components/pricing-table.tsx:7-17` (PricingTier interface)
- Modify: `packages/presentation/src/components/pricing-table.tsx:142` (PricingCardFull price render)
- Modify: `packages/presentation/src/components/pricing-table.tsx:225` (PricingCardCompact price render)

- [ ] **Step 1: Update PricingTier interface**

In `packages/presentation/src/components/pricing-table.tsx`, change line 10:

```ts
// Before:
  price: string
// After:
  price?: string
```

- [ ] **Step 2: Add null-coalescing to PricingCardFull**

Line 142, change:

```ts
// Before:
{
  tier.price;
}
// After:
{
  tier.price ?? "—";
}
```

- [ ] **Step 3: Add null-coalescing to PricingCardCompact**

Line 225, change:

```ts
// Before:
        <span className="text-2xl font-bold text-zinc-900 dark:text-white">{tier.price}</span>
// After:
        <span className="text-2xl font-bold text-zinc-900 dark:text-white">{tier.price ?? '—'}</span>
```

- [ ] **Step 4: Run typecheck on presentation**

Run: `pnpm --filter @revealui/presentation typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/presentation/src/components/pricing-table.tsx
git commit -m "fix(presentation): handle optional price in PricingTable

PricingTier.price is now optional. Both PricingCardFull and
PricingCardCompact render '—' when price is undefined.

Part of MASTER_PLAN §3.8 Step 6."
```

---

### Task 3: Update contracts tests

**Files:**

- Modify: `packages/contracts/src/__tests__/pricing.test.ts`

- [ ] **Step 1: Update SUBSCRIPTION_TIERS test — remove price assertion**

In `packages/contracts/src/__tests__/pricing.test.ts`, the test at lines 89-98 ("every tier has required fields") asserts `expect(tier.price).toBeTruthy()`. Remove that assertion. The test should become:

```ts
it("every tier has required structural fields", () => {
  for (const tier of SUBSCRIPTION_TIERS) {
    expect(tier.name).toBeTruthy();
    expect(tier.description).toBeTruthy();
    expect(tier.features.length).toBeGreaterThan(0);
    expect(tier.cta).toBeTruthy();
    expect(tier.ctaHref).toBeTruthy();
  }
});
```

- [ ] **Step 2: Add test for price fields being undefined in static arrays**

After the "every tier has required structural fields" test, add:

```ts
it("price fields are undefined in static arrays (populated at runtime)", () => {
  for (const tier of SUBSCRIPTION_TIERS) {
    expect(tier.price).toBeUndefined();
  }
});
```

- [ ] **Step 3: Remove period assertion from "paid tiers have /month period" test**

Lines 111-116 assert `expect(tier.period).toBe('/month')`. Since `period` is no longer in the static array, update:

```ts
it("paid tiers do not include period in static data (populated at runtime)", () => {
  const paid = SUBSCRIPTION_TIERS.filter((t) => t.id !== "free");
  for (const tier of paid) {
    expect(tier.period).toBeUndefined();
  }
});
```

- [ ] **Step 4: Update CREDIT_BUNDLES test — remove price/costPer assertions**

Lines 133-140 ("every bundle has required fields"): remove `price` and `costPer` assertions. Update to:

```ts
it("every bundle has required structural fields", () => {
  for (const bundle of CREDIT_BUNDLES) {
    expect(bundle.name).toBeTruthy();
    expect(bundle.tasks).toBeTruthy();
    expect(bundle.description).toBeTruthy();
  }
});
```

- [ ] **Step 5: Update PERPETUAL_TIERS test — remove price/priceNote assertions**

Lines 152-159 ("every tier has required fields"): remove `price` and `priceNote` assertions. Update to:

```ts
it("every tier has required structural fields", () => {
  for (const tier of PERPETUAL_TIERS) {
    expect(tier.name).toBeTruthy();
    expect(tier.description).toBeTruthy();
    expect(tier.features.length).toBeGreaterThan(0);
  }
});
```

- [ ] **Step 6: Run contracts tests**

Run: `pnpm --filter @revealui/contracts test`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add packages/contracts/src/__tests__/pricing.test.ts
git commit -m "test(contracts): update pricing tests for optional price fields

Remove assertions on dollar amounts. Add test verifying price fields
are undefined in static arrays (populated at runtime by /api/pricing).

Part of MASTER_PLAN §3.8 Step 6."
```

---

### Task 4: Update PricingTable tests

**Files:**

- Modify: `packages/presentation/src/__tests__/pricing-table.test.tsx`

- [ ] **Step 1: Add test for undefined price rendering**

Add a new test to the existing test file:

```ts
it('renders "—" when price is undefined', () => {
  const tiersWithoutPrice = [
    {
      id: 'free',
      name: 'Free',
      description: 'Free tier',
      features: ['Feature 1'],
      cta: 'Get Started',
      ctaHref: '/start',
      highlighted: false,
    },
  ]
  render(<PricingTable tiers={tiersWithoutPrice} />)
  expect(screen.getByText('—')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run presentation tests**

Run: `pnpm --filter @revealui/presentation test`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add packages/presentation/src/__tests__/pricing-table.test.tsx
git commit -m "test(presentation): add test for PricingTable with undefined price

Verifies the component renders '—' when price field is not provided.

Part of MASTER_PLAN §3.8 Step 6."
```

---

## Chunk 2: API Endpoint

### Task 5: Create GET /api/pricing endpoint

**Files:**

- Create: `apps/api/src/routes/pricing.ts`

- [ ] **Step 1: Write the pricing route**

Create `apps/api/src/routes/pricing.ts`:

```ts
/**
 * Pricing Route — serves tier/pricing data from Stripe with server-side fallback
 *
 * Public endpoint (no auth). Prices come from Stripe Products API when configured,
 * otherwise from private server-side defaults.
 */

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  CircuitBreaker,
  CircuitBreakerOpenError,
} from "@revealui/core/error-handling";
import { logger } from "@revealui/core/observability/logger";
import {
  CREDIT_BUNDLES,
  PERPETUAL_TIERS,
  type PricingResponse,
  SUBSCRIPTION_TIERS,
} from "@revealui/contracts/pricing";
import Stripe from "stripe";

const app = new OpenAPIHono();

// ---------------------------------------------------------------------------
// Stripe client (self-contained — does not share with billing.ts)
// ---------------------------------------------------------------------------

const pricingBreaker = new CircuitBreaker({
  failureThreshold: 3,
  resetTimeout: 60_000,
  successThreshold: 2,
});

function getStripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, { maxNetworkRetries: 2 });
}

// ---------------------------------------------------------------------------
// Server-side fallback prices (private — never exported or in contracts)
// ---------------------------------------------------------------------------

const FALLBACK_SUBSCRIPTION_PRICES: Record<
  string,
  { price: string; period?: string }
> = {
  free: { price: "$0" },
  pro: { price: "$49", period: "/month" },
  max: { price: "$149", period: "/month" },
  enterprise: { price: "$299", period: "/month" },
};

const FALLBACK_CREDIT_PRICES: Record<
  string,
  { price: string; priceNote: string; costPer: string }
> = {
  Starter: { price: "$10", priceNote: "one-time", costPer: "$0.001/task" },
  Standard: { price: "$50", priceNote: "one-time", costPer: "$0.00083/task" },
  Scale: { price: "$250", priceNote: "one-time", costPer: "$0.00071/task" },
};

const FALLBACK_PERPETUAL_PRICES: Record<
  string,
  { price: string; priceNote: string; renewal: string }
> = {
  "Pro Perpetual": {
    price: "$299",
    priceNote: "one-time",
    renewal: "$99/yr for continued support",
  },
  "Agency Perpetual": {
    price: "$799",
    priceNote: "one-time",
    renewal: "$199/yr for continued support",
  },
  "Forge Perpetual": {
    price: "$1,999",
    priceNote: "one-time",
    renewal: "$499/yr for continued support",
  },
};

// ---------------------------------------------------------------------------
// Stripe → pricing merge logic
// ---------------------------------------------------------------------------

function formatPrice(unitAmount: number): string {
  return `$${(unitAmount / 100).toFixed(0)}`;
}

function formatPeriod(interval: string | undefined): string | undefined {
  if (!interval) return undefined;
  return `/${interval}`;
}

interface StripeProductMap {
  subscriptions: Map<string, { price: string; period?: string }>;
  credits: Map<string, { price: string; priceNote: string; costPer: string }>;
  perpetual: Map<string, { price: string; priceNote: string; renewal: string }>;
}

async function fetchStripePrices(): Promise<StripeProductMap | null> {
  const stripe = getStripeClient();
  if (!stripe) return null;

  try {
    const result = await pricingBreaker.execute(async () => {
      const products = await stripe.products.list({
        active: true,
        expand: ["data.default_price"],
        limit: 100,
      });
      return products;
    });

    const map: StripeProductMap = {
      subscriptions: new Map(),
      credits: new Map(),
      perpetual: new Map(),
    };

    for (const product of result.data) {
      const track = product.metadata?.revealui_track;
      const tier = product.metadata?.revealui_tier;
      if (!track || !tier) continue;

      const defaultPrice = product.default_price as Stripe.Price | null;
      if (!defaultPrice?.unit_amount) continue;

      const priceStr = formatPrice(defaultPrice.unit_amount);

      if (track === "subscription") {
        map.subscriptions.set(tier, {
          price: priceStr,
          period: formatPeriod(defaultPrice.recurring?.interval),
        });
      } else if (track === "credit") {
        map.credits.set(product.name, {
          price: priceStr,
          priceNote: product.metadata?.revealui_price_note ?? "one-time",
          costPer: product.metadata?.revealui_cost_per ?? "",
        });
      } else if (track === "perpetual") {
        map.perpetual.set(product.name, {
          price: priceStr,
          priceNote: product.metadata?.revealui_price_note ?? "one-time",
          renewal: product.metadata?.revealui_renewal ?? "",
        });
      }
    }

    return map;
  } catch (error) {
    if (error instanceof CircuitBreakerOpenError) {
      logger.warn("Pricing: Stripe circuit breaker open, using fallback");
    } else {
      logger.error("Pricing: Stripe fetch failed, using fallback", { error });
    }
    return null;
  }
}

function buildPricingResponse(
  stripePrices: StripeProductMap | null,
): PricingResponse {
  const subscriptions = SUBSCRIPTION_TIERS.map((tier) => {
    const stripePrice = stripePrices?.subscriptions.get(tier.id);
    const fallback = FALLBACK_SUBSCRIPTION_PRICES[tier.id];
    return { ...tier, ...(stripePrice ?? fallback) };
  });

  const credits = CREDIT_BUNDLES.map((bundle) => {
    const stripePrice = stripePrices?.credits.get(bundle.name);
    const fallback = FALLBACK_CREDIT_PRICES[bundle.name];
    return { ...bundle, ...(stripePrice ?? fallback) };
  });

  const perpetual = PERPETUAL_TIERS.map((tier) => {
    const stripePrice = stripePrices?.perpetual.get(tier.name);
    const fallback = FALLBACK_PERPETUAL_PRICES[tier.name];
    return { ...tier, ...(stripePrice ?? fallback) };
  });

  return { subscriptions, credits, perpetual };
}

// ---------------------------------------------------------------------------
// Route definition
// ---------------------------------------------------------------------------

const PricingResponseSchema = z.object({
  subscriptions: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      price: z.string().optional(),
      period: z.string().optional(),
      description: z.string(),
      features: z.array(z.string()),
      cta: z.string(),
      ctaHref: z.string(),
      highlighted: z.boolean(),
    }),
  ),
  credits: z.array(
    z.object({
      name: z.string(),
      tasks: z.string(),
      price: z.string().optional(),
      priceNote: z.string().optional(),
      costPer: z.string().optional(),
      description: z.string(),
      highlighted: z.boolean(),
    }),
  ),
  perpetual: z.array(
    z.object({
      name: z.string(),
      price: z.string().optional(),
      priceNote: z.string().optional(),
      renewal: z.string().optional(),
      description: z.string(),
      features: z.array(z.string()),
      cta: z.string(),
      ctaHref: z.string(),
      comingSoon: z.boolean(),
    }),
  ),
});

const pricingRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["pricing"],
  summary: "Get pricing data",
  description:
    "Returns subscription tiers, credit bundles, and perpetual license pricing. Prices sourced from Stripe when configured, otherwise server-side defaults.",
  responses: {
    200: {
      content: { "application/json": { schema: PricingResponseSchema } },
      description: "Pricing data",
    },
  },
});

app.openapi(pricingRoute, async (c) => {
  const stripePrices = await fetchStripePrices();
  const response = buildPricingResponse(stripePrices);

  c.header(
    "Cache-Control",
    "public, s-maxage=3600, stale-while-revalidate=86400",
  );

  return c.json(response, 200);
});

export default app;
```

- [ ] **Step 2: Run typecheck on API**

Run: `pnpm --filter api typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/pricing.ts
git commit -m "feat(api): add GET /api/pricing endpoint

Serves merged pricing data from Stripe Products API (primary) with
server-side fallback defaults. Own CircuitBreaker instance. Cached
for 1 hour with 24h stale-while-revalidate.

Part of MASTER_PLAN §3.8 Step 6."
```

---

### Task 6: Mount pricing route + add rate limit

**Files:**

- Modify: `apps/api/src/index.ts:30-43` (imports)
- Modify: `apps/api/src/index.ts:183-197` (rate limit config)
- Modify: `apps/api/src/index.ts:413-449` (route mounting)

- [ ] **Step 1: Add import**

After line 43 (`import webhooksRoute from './routes/webhooks.js'`), add:

```ts
import pricingRoute from "./routes/pricing.js";
```

- [ ] **Step 2: Add rate limit entry**

In the `DEFAULT_RATE_LIMITS.routes` object (around line 196), add before the closing `}`:

```ts
    pricing: { maxRequests: 10, windowMs: ONE_MINUTE },
```

- [ ] **Step 3: Mount routes and rate limits**

After the marketplace rate limit lines (around line 269-270), add:

```ts
app.use("/api/pricing", routeLimit("pricing"));
app.use("/api/v1/pricing", routeLimit("pricing"));
```

In the route mounting section, after `app.route('/api/marketplace', marketplaceRoute)` (line 429), add:

```ts
app.route("/api/pricing", pricingRoute);
```

After `app.route('/api/v1/marketplace', marketplaceRoute)` (line 449), add:

```ts
app.route("/api/v1/pricing", pricingRoute);
```

- [ ] **Step 4: Run typecheck on API**

Run: `pnpm --filter api typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/index.ts
git commit -m "feat(api): mount pricing route with rate limit

GET /api/pricing and /api/v1/pricing mounted. Rate limited to
10 requests/min (public, heavily cached endpoint).

Part of MASTER_PLAN §3.8 Step 6."
```

---

### Task 7: Write pricing endpoint tests

**Files:**

- Create: `apps/api/src/routes/__tests__/pricing.test.ts`

- [ ] **Step 1: Write test file**

Create `apps/api/src/routes/__tests__/pricing.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock Stripe before imports
vi.mock("stripe", () => {
  return {
    default: class MockStripe {
      products = {
        list: vi.fn(),
      };
    },
  };
});

// Mock circuit breaker to pass through
vi.mock("@revealui/core/error-handling", () => ({
  CircuitBreaker: class {
    async execute<T>(fn: () => Promise<T>): Promise<T> {
      return fn();
    }
  },
  CircuitBreakerOpenError: class extends Error {},
}));

// Mock logger
vi.mock("@revealui/core/observability/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import app from "../pricing.js";

describe("GET /api/pricing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("returns pricing response with fallback when Stripe is not configured", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    const res = await app.request("/");
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.subscriptions).toHaveLength(4);
    expect(data.credits).toHaveLength(3);
    expect(data.perpetual).toHaveLength(3);

    // Fallback prices should be populated
    const pro = data.subscriptions.find((t: { id: string }) => t.id === "pro");
    expect(pro.price).toBe("$49");
    expect(pro.period).toBe("/month");
  });

  it("returns structural data from contracts", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    const res = await app.request("/");
    const data = await res.json();

    const free = data.subscriptions.find(
      (t: { id: string }) => t.id === "free",
    );
    expect(free.name).toBe("Free (OSS)");
    expect(free.features.length).toBeGreaterThan(0);
    expect(free.cta).toBe("Get Started");
  });

  it("sets cache headers", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    const res = await app.request("/");
    expect(res.headers.get("Cache-Control")).toBe(
      "public, s-maxage=3600, stale-while-revalidate=86400",
    );
  });

  it("returns all credit bundles with fallback prices", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    const res = await app.request("/");
    const data = await res.json();

    const standard = data.credits.find(
      (b: { name: string }) => b.name === "Standard",
    );
    expect(standard.price).toBe("$50");
    expect(standard.costPer).toBe("$0.00083/task");
    expect(standard.tasks).toBe("60,000");
  });

  it("returns all perpetual tiers with fallback prices", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    const res = await app.request("/");
    const data = await res.json();

    const proPerpetual = data.perpetual.find(
      (t: { name: string }) => t.name === "Pro Perpetual",
    );
    expect(proPerpetual.price).toBe("$299");
    expect(proPerpetual.renewal).toBe("$99/yr for continued support");
  });

  it("response matches expected shape", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    const res = await app.request("/");
    const data = await res.json();

    // Verify shape
    expect(data).toHaveProperty("subscriptions");
    expect(data).toHaveProperty("credits");
    expect(data).toHaveProperty("perpetual");

    // Verify subscription tier shape
    for (const tier of data.subscriptions) {
      expect(tier).toHaveProperty("id");
      expect(tier).toHaveProperty("name");
      expect(tier).toHaveProperty("description");
      expect(tier).toHaveProperty("features");
      expect(tier).toHaveProperty("cta");
      expect(tier).toHaveProperty("ctaHref");
      expect(tier).toHaveProperty("highlighted");
    }
  });
});
```

- [ ] **Step 2: Run tests**

Run: `pnpm --filter api test -- --run src/routes/__tests__/pricing.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/__tests__/pricing.test.ts
git commit -m "test(api): add pricing endpoint tests

Tests fallback pricing, cache headers, response shape, and all
three pricing tracks (subscriptions, credits, perpetual).

Part of MASTER_PLAN §3.8 Step 6."
```

---

## Chunk 3: Consumer Updates

### Task 8: Update marketing pricing page (ISR)

**Files:**

- Modify: `apps/marketing/src/app/pricing/page.tsx`

- [ ] **Step 1: Replace static imports with ISR fetch**

Replace the imports and `tiers` mapping at the top of the file (lines 1-22) with:

```ts
import type { PricingResponse } from "@revealui/contracts/pricing";
import type { Metadata } from "next";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Pricing — RevealUI",
  description:
    "Start free. Subscribe, pay per agent task, or buy a one-time license. Three ways to use RevealUI — pick what fits your business.",
  openGraph: {
    title: "Pricing — RevealUI",
    description:
      "Start free. Subscribe, pay per agent task, or buy a one-time license. Three ways to use RevealUI.",
    type: "website",
  },
};

const cmsUrl = process.env.NEXT_PUBLIC_CMS_URL || "https://cms.revealui.com";

async function getPricing(): Promise<PricingResponse | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://api.revealui.com";
  try {
    const res = await fetch(`${apiUrl}/api/pricing`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return (await res.json()) as PricingResponse;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Make the page component async and use fetched data**

Change the default export to async and fetch pricing. Replace `tiers` and direct references to `CREDIT_BUNDLES`/`PERPETUAL_TIERS`:

```ts
export default async function PricingPage() {
  const pricing = await getPricing()

  const tiers = (pricing?.subscriptions ?? []).map((tier) => ({
    ...tier,
    ctaHref: tier.ctaHref.startsWith('/') ? `${cmsUrl}${tier.ctaHref}` : tier.ctaHref,
  }))
  const creditBundles = pricing?.credits ?? []
  const perpetualTiers = pricing?.perpetual ?? []
```

- [ ] **Step 3: Update JSX to use null-coalesced prices**

Throughout the JSX, replace direct `{tier.price}` with `{tier.price ?? 'Contact us'}`, `{bundle.price ?? '—'}`, `{bundle.costPer ?? ''}`, `{bundle.priceNote ?? ''}`, `{tier.renewal ?? '—'}`, `{tier.priceNote ?? ''}`.

Replace `{CREDIT_BUNDLES.map(` with `{creditBundles.map(` and `{PERPETUAL_TIERS.map(` with `{perpetualTiers.map(`.

- [ ] **Step 4: Run typecheck**

Run: `pnpm --filter marketing typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/marketing/src/app/pricing/page.tsx
git commit -m "feat(marketing): fetch pricing via ISR from /api/pricing

Marketing pricing page now fetches from the API endpoint with 1-hour
ISR revalidation. Falls back to structure without prices if API
unavailable. All price renders use null-coalescing.

Part of MASTER_PLAN §3.8 Step 6."
```

---

### Task 9: Remove hardcoded prices from CMS billing page

**Files:**

- Modify: `apps/cms/src/app/(frontend)/account/billing/page.tsx`

- [ ] **Step 1: Read the billing page to identify all hardcoded prices**

Read the full file to find all 4 hardcoded price strings and the existing `useEffect` fetch pattern.

- [ ] **Step 2: Add pricing fetch to existing useEffect**

Add `PricingResponse` type import and a `pricing` state variable. In the existing `fetchData` function (inside `useEffect`), add a fetch to `/api/pricing` alongside the existing subscription/usage fetches. Store result in state.

- [ ] **Step 3: Replace hardcoded price strings**

Replace each hardcoded price string with a lookup from the fetched pricing data:

- Trial message: use `pricing?.subscriptions.find(t => t.id === 'pro')?.price ?? '$—'`
- Button labels: use `${tier.price ?? '—'}${tier.period ?? ''}`

- [ ] **Step 4: Run typecheck**

Run: `pnpm --filter cms typecheck`
Expected: PASS (may have pre-existing productsProxy.ts error — that's not from our changes)

- [ ] **Step 5: Commit**

```bash
git add apps/cms/src/app/\(frontend\)/account/billing/page.tsx
git commit -m "fix(cms): remove hardcoded prices from billing page

Billing page now fetches pricing from /api/pricing alongside existing
subscription data. Replaced 4 hardcoded dollar strings with dynamic
values from the API response.

Part of MASTER_PLAN §3.8 Step 6."
```

---

### Task 10: Remove hardcoded prices from CMS license page

**Files:**

- Modify: `apps/cms/src/app/(frontend)/account/license/page.tsx:29-44`

- [ ] **Step 1: Read the license page**

Read the full file to understand the `PERPETUAL_PLANS` constant and how it's used.

- [ ] **Step 2: Remove prices from PERPETUAL_PLANS and fetch from API**

Add pricing fetch to the existing `useEffect`. Replace the hardcoded `price` field in `PERPETUAL_PLANS` with data from the API response:

```ts
const perpetualPricing = pricing?.perpetual ?? [];
// Map PERPETUAL_PLANS to use fetched prices
const plans = PERPETUAL_PLANS.map((plan) => {
  const fetched = perpetualPricing.find((t) =>
    t.name.toLowerCase().startsWith(plan.tier),
  );
  return { ...plan, price: fetched?.price ?? "—" };
});
```

- [ ] **Step 3: Remove hardcoded `$299` and `$799` from the constant**

Change `PERPETUAL_PLANS` to omit the `price` field entirely.

- [ ] **Step 4: Run typecheck**

Run: `pnpm --filter cms typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/cms/src/app/\(frontend\)/account/license/page.tsx
git commit -m "fix(cms): remove hardcoded perpetual prices from license page

License page now fetches pricing from /api/pricing. Replaced hardcoded
\$299 and \$799 with dynamic values.

Part of MASTER_PLAN §3.8 Step 6."
```

---

### Task 11: Update remaining test files

**Files:**

- Modify: `apps/marketing/src/app/pricing/__tests__/pricing-data.test.ts`
- Modify: `apps/cms/src/lib/components/__tests__/UpgradeDialog.test.tsx`

- [ ] **Step 1: Read the marketing pricing data test**

Read `apps/marketing/src/app/pricing/__tests__/pricing-data.test.ts` to understand current assertions.

- [ ] **Step 2: Update marketing pricing test**

Remove assertions on `.price`, `.costPer`, `.priceNote`, `.renewal` fields. Keep structural assertions (count, names, features).

- [ ] **Step 3: Read the UpgradeDialog test**

Read `apps/cms/src/lib/components/__tests__/UpgradeDialog.test.tsx` to find mock tiers with hardcoded prices.

- [ ] **Step 4: Update UpgradeDialog test mocks**

Remove `price` from mock tier objects (since it's now optional, the mocks should work without it). Or keep them as test data — both are valid since `price` is optional.

- [ ] **Step 5: Run all affected tests**

Run:

```bash
pnpm --filter @revealui/contracts test
pnpm --filter @revealui/presentation test
pnpm --filter api test
```

Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add apps/marketing/src/app/pricing/__tests__/pricing-data.test.ts apps/cms/src/lib/components/__tests__/UpgradeDialog.test.tsx
git commit -m "test: update pricing tests for optional price fields

Marketing pricing data test and UpgradeDialog test updated to
reflect that price fields are now optional in static arrays.

Part of MASTER_PLAN §3.8 Step 6."
```

---

## Chunk 4: Verification

### Task 12: Full verification

- [ ] **Step 1: Run full typecheck**

Run: `pnpm typecheck:all`
Expected: PASS (pre-existing productsProxy.ts error in CMS is acceptable)

- [ ] **Step 2: Run full test suite**

Run: `pnpm test`
Expected: All tests PASS

- [ ] **Step 3: Run Biome lint**

Run: `pnpm lint`
Expected: No new errors

- [ ] **Step 4: Verify no dollar amounts in contracts**

Run: `grep -n '\$[0-9]' packages/contracts/src/pricing.ts`
Expected: No output (zero matches)

- [ ] **Step 5: Verify fallback prices are only in the API route**

Run: `grep -rn '\$49\|\\$149\|\\$299\|\\$799\|\\$1,999' apps/api/src/routes/pricing.ts`
Expected: Matches found (these are the private fallbacks — correct)

Run: `grep -rn '\$49\|\\$149\|\\$299' packages/contracts/src/`
Expected: No matches

- [ ] **Step 6: Final commit if any formatting changes from Biome**

```bash
git add -A
git commit -m "chore: format after pricing runtime migration"
```
