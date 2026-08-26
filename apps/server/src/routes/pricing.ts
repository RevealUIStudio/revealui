/**
 * Pricing Route  -  serves tier/pricing data from Stripe with server-side fallback
 *
 * Public endpoint (no auth). Prices come from Stripe Products API when configured,
 * otherwise from private server-side defaults.
 */

import {
  allowsUnattendedCheckout,
  isPublicPerpetualCatalogName,
  type LicenseTierId,
  PERPETUAL_TIERS,
  type PricingResponse,
  type ServiceOffering,
  SUBSCRIPTION_TIERS,
} from '@revealui/contracts/pricing';
import { CircuitBreaker, CircuitBreakerOpenError } from '@revealui/core/error-handling';
import { logger } from '@revealui/core/observability/logger';
import { createRoute, OpenAPIHono, z } from '@revealui/openapi';
import type Stripe from 'stripe';
import { getServices } from '../lib/services-loader.js';

const app = new OpenAPIHono();

// ---------------------------------------------------------------------------
// Stripe client (GAP-131): the actual Stripe call goes through the shared
// protectedStripe wrapper (DB-backed circuit breaker + retry, single API
// version pin). The local `pricingBreaker` remains as a per-route fast-fail
// guard that flips the response to fallback prices without waiting for the
// DB breaker round-trip — pricing is hot-path public data and the fallback
// is the right answer when Stripe is degraded.
// ---------------------------------------------------------------------------

const pricingBreaker = new CircuitBreaker({
  failureThreshold: 3,
  resetTimeout: 60_000,
  successThreshold: 2,
});

function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

// ---------------------------------------------------------------------------
// Server-side fallback prices (private  -  never exported or in contracts)
//
// These are used when Stripe is unreachable (circuit breaker open, key missing).
// Override via FALLBACK_PRICING_JSON env var to keep prices in sync without redeploying.
// Format: JSON string with keys "subscriptions", "credits", "perpetual".
// ---------------------------------------------------------------------------

const HARDCODED_SUBSCRIPTION_PRICES: Record<string, { price: string; period?: string }> = {
  free: { price: '$0' },
  pro: { price: '$49', period: '/month' },
  max: { price: '$299', period: '/month' },
  // Enterprise is inquire-only on the public catalog — no monthly unit amount.
};

// Annual prices are the cents-of-record from the Stripe CATALOG. Included in
// the response only when the matching annual price-ID env var is set — that is
// the "no annual CTA without a resolvable annual price" lockstep guard.
const HARDCODED_ANNUAL_SUBSCRIPTION_PRICES: Record<
  string,
  { annualPrice: string; annualPeriod: string }
> = {
  pro: { annualPrice: '$470', annualPeriod: '/year' },
  max: { annualPrice: '$2,870', annualPeriod: '/year' },
};

const ANNUAL_PRICE_ENV_GUARDS: Record<string, string> = {
  pro: 'STRIPE_PRO_ANNUAL_PRICE_ID',
  max: 'STRIPE_MAX_ANNUAL_PRICE_ID',
};

const HARDCODED_PERPETUAL_PRICES: Record<
  string,
  { price: string; priceNote: string; renewal: string }
> = {
  'Pro Perpetual': {
    price: '$1,499',
    priceNote: 'one-time',
    renewal: '$149/yr for continued support',
  },
};

function loadFallbackPrices(): {
  subscriptions: Record<string, { price: string; period?: string }>;
  perpetual: Record<string, { price: string; priceNote: string; renewal: string }>;
} {
  const envJson = process.env.FALLBACK_PRICING_JSON;
  if (envJson) {
    try {
      const parsed = JSON.parse(envJson);
      return {
        subscriptions: parsed.subscriptions ?? HARDCODED_SUBSCRIPTION_PRICES,
        perpetual: parsed.perpetual ?? HARDCODED_PERPETUAL_PRICES,
      };
    } catch {
      logger.error('Failed to parse FALLBACK_PRICING_JSON  -  using hardcoded defaults');
    }
  }
  if (process.env.NODE_ENV === 'production' && !envJson) {
    logger.warn(
      'FALLBACK_PRICING_JSON not set  -  fallback prices use hardcoded defaults which may become stale',
    );
  }
  return {
    subscriptions: HARDCODED_SUBSCRIPTION_PRICES,
    perpetual: HARDCODED_PERPETUAL_PRICES,
  };
}

const { subscriptions: FALLBACK_SUBSCRIPTION_PRICES, perpetual: FALLBACK_PERPETUAL_PRICES } =
  loadFallbackPrices();

// ---------------------------------------------------------------------------
// Stripe → pricing merge logic
// ---------------------------------------------------------------------------

const USD_WHOLE_DOLLARS = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function formatPrice(unitAmount: number): string {
  return USD_WHOLE_DOLLARS.format(unitAmount / 100);
}

function formatPeriod(interval: string | undefined): string | undefined {
  if (!interval) return undefined;
  return `/${interval}`;
}

interface StripeProductMap {
  subscriptions: Map<string, { price: string; period?: string }>;
  credits: Map<string, { price: string; priceNote: string; costPer: string }>;
  perpetual: Map<string, { price: string; priceNote: string; renewal: string }>;
  services: Map<string, { price: string; priceNote?: string }>;
}

async function fetchStripePrices(): Promise<StripeProductMap | null> {
  if (!isStripeConfigured()) return null;

  // @revealui/services is an optional peer; missing package == fallback prices.
  const services = await getServices();
  if (!services) return null;

  try {
    const result = await pricingBreaker.execute(async () => {
      const products = await services.protectedStripe.products.list({
        active: true,
        expand: ['data.default_price'],
        limit: 100,
      });
      return products;
    });

    const map: StripeProductMap = {
      subscriptions: new Map(),
      credits: new Map(),
      perpetual: new Map(),
      services: new Map(),
    };

    for (const product of result.data) {
      const track = product.metadata?.revealui_track;
      const tier = product.metadata?.revealui_tier;
      if (!(track && tier)) continue;

      const defaultPrice = product.default_price as Stripe.Price | null;
      if (!defaultPrice?.unit_amount) continue;

      const priceStr = formatPrice(defaultPrice.unit_amount);

      if (track === 'subscription') {
        map.subscriptions.set(tier, {
          price: priceStr,
          period: formatPeriod(defaultPrice.recurring?.interval),
        });
      } else if (track === 'credit') {
        map.credits.set(product.name, {
          price: priceStr,
          priceNote: product.metadata?.revealui_price_note ?? 'one-time',
          costPer: product.metadata?.revealui_cost_per ?? '',
        });
      } else if (track === 'perpetual') {
        map.perpetual.set(product.name, {
          price: priceStr,
          priceNote: product.metadata?.revealui_price_note ?? 'one-time',
          renewal: product.metadata?.revealui_renewal ?? '',
        });
      } else if (track === 'service') {
        const serviceId = product.metadata?.revealui_service_id ?? tier;
        map.services.set(serviceId, {
          price: priceStr,
          priceNote: product.metadata?.revealui_price_note,
        });
      }
    }

    return map;
  } catch (error) {
    if (error instanceof CircuitBreakerOpenError) {
      logger.warn('Pricing: Stripe circuit breaker open, using fallback');
    } else {
      logger.error(
        'Pricing: Stripe fetch failed, using fallback',
        error instanceof Error ? error : new Error(String(error)),
      );
    }
    return null;
  }
}

function isInquireOnlySubscription(tierId: string): boolean {
  return tierId !== 'free' && !allowsUnattendedCheckout(tierId as LicenseTierId);
}

function buildPricingResponse(stripePrices: StripeProductMap | null): PricingResponse {
  const subscriptions = SUBSCRIPTION_TIERS.map((tier) => {
    // Enterprise stays in the catalog as contact-sales / inquire — no monthly
    // unit amount, even if Stripe or FALLBACK_PRICING_JSON still list $1,499.
    if (isInquireOnlySubscription(tier.id)) {
      return { ...tier };
    }
    const stripePrice = stripePrices?.subscriptions.get(tier.id);
    const fallback = FALLBACK_SUBSCRIPTION_PRICES[tier.id];
    const annualGuardEnv = ANNUAL_PRICE_ENV_GUARDS[tier.id];
    const annualPrices =
      annualGuardEnv && process.env[annualGuardEnv]
        ? HARDCODED_ANNUAL_SUBSCRIPTION_PRICES[tier.id]
        : undefined;
    return { ...tier, ...(stripePrice ?? fallback), ...annualPrices };
  });

  // Credit packs ($10 / $50 / $250) are not sold on the public catalog.
  // FAQ already says overage is not charged. Keep the credits key empty.
  const credits: PricingResponse['credits'] = [];

  const perpetual = PERPETUAL_TIERS.filter((tier) => isPublicPerpetualCatalogName(tier.name)).map(
    (tier) => {
      const stripePrice = stripePrices?.perpetual.get(tier.name);
      const fallback = FALLBACK_PERPETUAL_PRICES[tier.name];
      return { ...tier, ...(stripePrice ?? fallback) };
    },
  );

  // Services intentionally returned as empty array pending fulfillment infrastructure.
  // FOUNDER_SERVICE_OFFERINGS still exports 4 offerings from @revealui/contracts, but they are NOT
  // exposed on the public pricing API because (a) no Stripe products exist for them,
  // (b) no `service` track exists in `billing_model` CHECK constraint, (c) no booking
  // automation fires when a customer hits the cal.com link. Services are available via
  // direct outreach to founder@revealui.com. To re-enable, build the 'service' billing
  // track end-to-end first: seed-stripe.ts entries + schema CHECK update + service_engagements
  // table + cal.com webhook receiver + Stripe Invoicing flow. Tracked in OWNER_ACTIONS.md.
  const services: ServiceOffering[] = [];

  return { subscriptions, credits, perpetual, services };
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
      annualPrice: z.string().optional(),
      annualPeriod: z.string().optional(),
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
  services: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      price: z.string().optional(),
      priceNote: z.string().optional(),
      description: z.string(),
      includes: z.array(z.string()),
      deliverable: z.string(),
      cta: z.string(),
      ctaHref: z.string(),
    }),
  ),
});

const pricingRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['pricing'],
  summary: 'Get pricing data',
  description:
    'Returns subscription tiers, credit bundles, and perpetual license pricing. Prices sourced from Stripe when configured, otherwise server-side defaults.',
  responses: {
    200: {
      content: { 'application/json': { schema: PricingResponseSchema } },
      description: 'Pricing data',
    },
  },
});

app.openapi(pricingRoute, async (c) => {
  const stripePrices = await fetchStripePrices();
  const response = buildPricingResponse(stripePrices);

  c.header('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');

  return c.json(response, 200);
});

export default app;
