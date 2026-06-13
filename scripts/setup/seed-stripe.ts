#!/usr/bin/env tsx

/**
 * Stripe Infrastructure-as-Code Seed Script
 *
 * Declares RevealUI's full Stripe configuration as code and syncs it idempotently:
 *   - Products & prices (Pro, Max, Enterprise)
 *   - Webhook endpoint (with canonical event list)
 *   - Billing portal configuration (plan switching, cancellation, invoice history)
 *
 * Idempotent  -  safe to run multiple times. Dedupes by Stripe lookup_key (metadata-key fallback during migration).
 *
 * Usage:
 *   pnpm stripe:seed                         # sync all (products + webhook + portal)
 *   pnpm stripe:seed -- --dry-run            # preview, no writes
 *   pnpm stripe:seed -- --skip-webhook       # skip webhook endpoint setup
 *   pnpm stripe:seed -- --skip-portal        # skip billing portal setup
 *   pnpm stripe:seed -- --skip-catalog-sync  # skip local billing_catalog sync
 *   pnpm stripe:seed -- --webhook-url URL    # override webhook URL
 *   pnpm stripe:seed -- --sync-revvault      # write IDs to revvault (source of truth), then `revvault sync vercel`
 *   pnpm stripe:seed -- --sync-vercel        # DEPRECATED: writes Vercel directly; prefer --sync-revvault
 */

import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { config } from 'dotenv';
import type Stripe from 'stripe';
// Relative TS import resolves via tsx at script runtime; avoids adding
// @revealui/contracts as a root-level dep. Script only; not bundled.
import { RELEVANT_STRIPE_WEBHOOK_EVENTS } from '../../packages/contracts/src/stripe-webhook-events.js';
import { LOCAL_STRIPE_ENV_CACHE_PATH } from './stripe-env-cache-path.js';
import {
  type PriceDefinition,
  priceMatchesDefinition,
  priceSharesHandle,
} from './stripe-price-match.js';
import { syncToRevvault } from './stripe-revvault-sync.js';

// Load env from root .env
config({ path: resolve(import.meta.dirname, '../../.env') });

// Stripe is installed in packages/services  -  resolve from there.
// Stripe SDK 22.0.1+ shipped CJS as `module.exports = Stripe` directly
// (no `.default` wrapper). Older versions exported `{ default: Stripe }`.
// Defensive `default ?? module` handles both shapes so future SDK
// upgrades don't re-break this require.
const require = createRequire(resolve(import.meta.dirname, '../../packages/services/'));
const stripeModule = require('stripe') as { default?: typeof Stripe } & typeof Stripe;
const StripeConstructor = (stripeModule.default ?? stripeModule) as typeof Stripe;

// ─── Product Catalog ────────────────────────────────────────────────────────

interface ProductDefinition {
  key: string;
  name: string;
  description: string;
  tier: 'pro' | 'max' | 'enterprise';
  billingModel: 'subscription' | 'perpetual' | 'credits' | 'renewal';
  creditBundleName?: string;
  priceNote?: string;
  renewal?: string;
  defaultPriceKey: string;
  prices: PriceDefinition[];
}

interface LocalStripeCatalogCache {
  generatedAt: string;
  envVars: Record<string, string>;
  catalogEntries: Array<{
    planId: string;
    tier: 'pro' | 'max' | 'enterprise';
    billingModel: 'subscription' | 'perpetual' | 'credits' | 'renewal';
    stripeProductId: string;
    stripePriceId: string;
  }>;
}

const CATALOG: ProductDefinition[] = [
  {
    key: 'revealui_pro',
    name: 'RevealUI Pro',
    description:
      'AI agents, MCP servers, editor integrations, and advanced sync. For professional developers and small teams.',
    tier: 'pro',
    billingModel: 'subscription',
    defaultPriceKey: 'revealui_pro_monthly',
    prices: [
      {
        key: 'revealui_pro_monthly',
        unitAmount: 4900,
        currency: 'usd',
        mode: 'subscription',
        interval: 'month',
        trialDays: 7,
      },
      {
        key: 'revealui_pro_yearly',
        unitAmount: 47000,
        currency: 'usd',
        mode: 'subscription',
        interval: 'year',
        trialDays: 7,
      },
    ],
  },
  {
    key: 'revealui_max',
    name: 'RevealUI Max',
    description:
      'AI memory, advanced inference configuration, audit log, and higher limits (15 projects, 100 users).',
    tier: 'max',
    billingModel: 'subscription',
    defaultPriceKey: 'revealui_max_monthly',
    prices: [
      {
        key: 'revealui_max_monthly',
        unitAmount: 29900,
        currency: 'usd',
        mode: 'subscription',
        interval: 'month',
        trialDays: 7,
      },
      {
        key: 'revealui_max_yearly',
        unitAmount: 287000,
        currency: 'usd',
        mode: 'subscription',
        interval: 'year',
        trialDays: 7,
      },
    ],
  },
  {
    key: 'revealui_enterprise',
    name: 'RevealUI Enterprise',
    description:
      'SSO, audit logging, white-label, self-hosted deployment, and priority support. For agencies and enterprise teams.',
    tier: 'enterprise',
    billingModel: 'subscription',
    defaultPriceKey: 'revealui_enterprise_monthly',
    prices: [
      {
        key: 'revealui_enterprise_monthly',
        unitAmount: 149900,
        currency: 'usd',
        mode: 'subscription',
        interval: 'month',
      },
      {
        key: 'revealui_enterprise_yearly',
        unitAmount: 1439000,
        currency: 'usd',
        mode: 'subscription',
        interval: 'year',
      },
    ],
  },
  {
    key: 'revealui_pro_perpetual',
    name: 'Pro Perpetual',
    description: 'Pro features, forever. No subscription required.',
    tier: 'pro',
    billingModel: 'perpetual',
    priceNote: 'one-time',
    renewal: '$149/yr for continued support',
    defaultPriceKey: 'revealui_pro_perpetual',
    prices: [
      {
        key: 'revealui_pro_perpetual',
        unitAmount: 149900,
        currency: 'usd',
        mode: 'payment',
      },
    ],
  },
  {
    key: 'revealui_max_perpetual',
    name: 'Agency Perpetual',
    description: 'Deploy for multiple clients without per-site subscriptions.',
    tier: 'max',
    billingModel: 'perpetual',
    priceNote: 'one-time',
    renewal: '$799/yr for continued support',
    defaultPriceKey: 'revealui_max_perpetual',
    prices: [
      {
        key: 'revealui_max_perpetual',
        unitAmount: 849900,
        currency: 'usd',
        mode: 'payment',
      },
    ],
  },
  {
    key: 'revealui_enterprise_perpetual',
    name: 'Enterprise Perpetual',
    description: 'Full self-hosted Enterprise with unlimited deployments.',
    tier: 'enterprise',
    billingModel: 'perpetual',
    priceNote: 'one-time',
    renewal: '$3,999/yr for continued support',
    defaultPriceKey: 'revealui_enterprise_perpetual',
    prices: [
      {
        key: 'revealui_enterprise_perpetual',
        unitAmount: 4299900,
        currency: 'usd',
        mode: 'payment',
      },
    ],
  },
  // ── Support Renewal (Track C  -  annual renewal for perpetual licenses) ─────
  {
    key: 'revealui_renewal_pro',
    name: 'Pro Support Renewal',
    description: 'Renew your Pro perpetual license support contract for 1 year.',
    tier: 'pro',
    billingModel: 'renewal',
    priceNote: 'annual',
    defaultPriceKey: 'revealui_renewal_pro',
    prices: [
      {
        key: 'revealui_renewal_pro',
        unitAmount: 14900,
        currency: 'usd',
        mode: 'payment',
      },
    ],
  },
  {
    key: 'revealui_renewal_max',
    name: 'Max Support Renewal',
    description: 'Renew your Max/Agency perpetual license support contract for 1 year.',
    tier: 'max',
    billingModel: 'renewal',
    priceNote: 'annual',
    defaultPriceKey: 'revealui_renewal_max',
    prices: [
      {
        key: 'revealui_renewal_max',
        unitAmount: 79900,
        currency: 'usd',
        mode: 'payment',
      },
    ],
  },
  {
    key: 'revealui_renewal_enterprise',
    name: 'Enterprise Support Renewal',
    description: 'Renew your Enterprise perpetual license support contract for 1 year.',
    tier: 'enterprise',
    billingModel: 'renewal',
    priceNote: 'annual',
    defaultPriceKey: 'revealui_renewal_enterprise',
    prices: [
      {
        key: 'revealui_renewal_enterprise',
        unitAmount: 399900,
        currency: 'usd',
        mode: 'payment',
      },
    ],
  },
  // ── Credit Bundles (Track B) ──────────────────────────────────────────────
  {
    key: 'revealui_credits_starter',
    name: 'Credits: Starter',
    description: '10,000 AI agent tasks. Top up any plan. Never expires.',
    tier: 'pro',
    billingModel: 'credits',
    creditBundleName: 'starter',
    priceNote: 'one-time',
    defaultPriceKey: 'revealui_credits_starter',
    prices: [
      {
        key: 'revealui_credits_starter',
        unitAmount: 1000,
        currency: 'usd',
        mode: 'payment',
      },
    ],
  },
  {
    key: 'revealui_credits_standard',
    name: 'Credits: Standard',
    description: '60,000 AI agent tasks. 17% cheaper per task vs Starter.',
    tier: 'pro',
    billingModel: 'credits',
    creditBundleName: 'standard',
    priceNote: 'one-time',
    defaultPriceKey: 'revealui_credits_standard',
    prices: [
      {
        key: 'revealui_credits_standard',
        unitAmount: 5000,
        currency: 'usd',
        mode: 'payment',
      },
    ],
  },
  {
    key: 'revealui_credits_scale',
    name: 'Credits: Scale',
    description: '350,000 AI agent tasks. 29% cheaper per task vs Starter.',
    tier: 'pro',
    billingModel: 'credits',
    creditBundleName: 'scale',
    priceNote: 'one-time',
    defaultPriceKey: 'revealui_credits_scale',
    prices: [
      {
        key: 'revealui_credits_scale',
        unitAmount: 25000,
        currency: 'usd',
        mode: 'payment',
      },
    ],
  },
];

// Canonical webhook events now sourced from `@revealui/contracts` so this
// script and `apps/server/src/routes/webhooks.ts` cannot drift.
// `satisfies` preserves type-checking: if any event name in the shared
// constant is NOT a valid Stripe EnabledEvent (e.g. stripe SDK types
// change), TypeScript errors here rather than silently accepting it.
// Tracked by CR-8 audit finding revealui#406.
const WEBHOOK_EVENTS = [
  ...RELEVANT_STRIPE_WEBHOOK_EVENTS,
] satisfies Stripe.WebhookEndpointCreateParams.EnabledEvent[];

// Env vars to track: public-facing price IDs + server-side aliases
const PRICE_ENV_KEYS: Record<string, string> = {
  revealui_pro_monthly: 'NEXT_PUBLIC_STRIPE_PRO_PRICE_ID',
  revealui_max_monthly: 'NEXT_PUBLIC_STRIPE_MAX_PRICE_ID',
  revealui_max_yearly: 'NEXT_PUBLIC_STRIPE_MAX_ANNUAL_PRICE_ID',
  revealui_enterprise_monthly: 'NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID',
  revealui_pro_perpetual: 'NEXT_PUBLIC_STRIPE_PRO_PERPETUAL_PRICE_ID',
  revealui_max_perpetual: 'NEXT_PUBLIC_STRIPE_MAX_PERPETUAL_PRICE_ID',
  revealui_enterprise_perpetual: 'NEXT_PUBLIC_STRIPE_ENTERPRISE_PERPETUAL_PRICE_ID',
};
const PRICE_SERVER_ENV_KEYS: Record<string, string> = {
  revealui_pro_monthly: 'STRIPE_PRO_PRICE_ID',
  revealui_max_monthly: 'STRIPE_MAX_PRICE_ID',
  revealui_max_yearly: 'STRIPE_MAX_ANNUAL_PRICE_ID',
  revealui_enterprise_monthly: 'STRIPE_ENTERPRISE_PRICE_ID',
  revealui_pro_perpetual: 'STRIPE_PERPETUAL_PRO_PRICE_ID',
  revealui_max_perpetual: 'STRIPE_PERPETUAL_MAX_PRICE_ID',
  revealui_enterprise_perpetual: 'STRIPE_PERPETUAL_ENTERPRISE_PRICE_ID',
  revealui_renewal_pro: 'STRIPE_RENEWAL_PRO_PRICE_ID',
  revealui_renewal_max: 'STRIPE_RENEWAL_MAX_PRICE_ID',
  revealui_renewal_enterprise: 'STRIPE_RENEWAL_ENTERPRISE_PRICE_ID',
  revealui_credits_starter: 'STRIPE_CREDITS_STARTER_PRICE_ID',
  revealui_credits_standard: 'STRIPE_CREDITS_STANDARD_PRICE_ID',
  revealui_credits_scale: 'STRIPE_CREDITS_SCALE_PRICE_ID',
};

// ─── Stripe Billing Meter (Track B agent task overage) ──────────────────────
// The runtime emits meter events at apps/server/src/routes/billing.ts:1894
// using STRIPE_AGENT_METER_EVENT_NAME (fallback 'agent_task_overage'). The
// meter must exist BEFORE meter events can land — this seed creates it
// idempotently. Track B per MASTER_PLAN §5.1.
const AGENT_METER_EVENT_NAME = 'agent_task_overage';
const AGENT_METER_DISPLAY_NAME = 'Agent task overage';

// ─── Stripe Tax categories ──────────────────────────────────────────────────
// Stripe Tax requires explicit tax categories on every product/price before
// account-level Tax can be enabled cleanly.
//
// Per Stripe Tax Code Lookup (https://stripe.com/docs/tax/tax-codes):
//   txcd_10103000 = "Software as a Service (SaaS)" — RevealUI's product class.
//
// tax_behavior: 'exclusive' = tax added on top (B2B norm). NOTE: tax_behavior
// is IMMUTABLE on Stripe prices once set to a non-'unspecified' value —
// choose carefully. Owner cross-checks both at dry-run BEFORE the live run.
const PRODUCT_TAX_CODE = 'txcd_10103000';
const PRICE_TAX_BEHAVIOR: Stripe.PriceCreateParams.TaxBehavior = 'exclusive';

function productTaxCode(p: Stripe.Product): string | null {
  return typeof p.tax_code === 'string' ? p.tax_code : (p.tax_code?.id ?? null);
}

// ─── Logger ─────────────────────────────────────────────────────────────────

const log = {
  header: (msg: string) => console.log(`\n${'═'.repeat(60)}\n  ${msg}\n${'═'.repeat(60)}`),
  info: (msg: string) => console.log(`  i ${msg}`),
  success: (msg: string) => console.log(`  ✓ ${msg}`),
  warn: (msg: string) => console.log(`  ! ${msg}`),
  error: (msg: string) => console.error(`  ✗ ${msg}`),
  env: (key: string, value: string) => console.log(`\n  ${key}=${value}`),
};

function isLocalWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === '::1'
    );
  } catch {
    return false;
  }
}

// ─── Billing Meter ──────────────────────────────────────────────────────────

async function ensureBillingMeter(
  stripe: Stripe,
  dryRun: boolean,
): Promise<Stripe.Billing.Meter | null> {
  log.info('');
  log.info(`Meter event name: ${AGENT_METER_EVENT_NAME}`);

  const allMeters = await stripe.billing.meters
    .list({ status: 'active' })
    .autoPagingToArray({ limit: 10_000 });
  const match = allMeters.find((m) => m.event_name === AGENT_METER_EVENT_NAME);

  if (match) {
    log.success(`Meter exists: ${match.id} (${match.event_name})`);
    return match;
  }

  if (dryRun) {
    log.info(`Would create meter: ${AGENT_METER_EVENT_NAME} (${AGENT_METER_DISPLAY_NAME})`);
    return null;
  }

  const meter = await stripe.billing.meters.create({
    display_name: AGENT_METER_DISPLAY_NAME,
    event_name: AGENT_METER_EVENT_NAME,
    default_aggregation: { formula: 'sum' },
    customer_mapping: {
      type: 'by_id',
      event_payload_key: 'stripe_customer_id',
    },
    value_settings: { event_payload_key: 'value' },
  });

  log.success(`Created meter: ${meter.id} (${meter.event_name})`);
  return meter;
}

// ─── Products & Prices ───────────────────────────────────────────────────────

async function syncCatalog(
  stripe: Stripe,
  dryRun: boolean,
): Promise<{
  envVars: Record<string, string>;
  subscriptionProducts: Array<{ productId: string; priceIds: string[] }>;
  catalogEntries: LocalStripeCatalogCache['catalogEntries'];
}> {
  const envVars: Record<string, string> = {};
  const subscriptionProducts: Array<{ productId: string; priceIds: string[] }> = [];
  const catalogEntries: LocalStripeCatalogCache['catalogEntries'] = [];

  for (const productDef of CATALOG) {
    log.info('');
    log.info(`Processing: ${productDef.name} (${productDef.key})`);

    const allProducts = await stripe.products
      .list({ active: true })
      .autoPagingToArray({ limit: 10_000 });
    const existingProduct = allProducts.find(
      (p) => p.metadata.revealui_product_key === productDef.key,
    );

    let product: Stripe.Product;

    if (existingProduct) {
      if (
        existingProduct.name !== productDef.name ||
        existingProduct.description !== productDef.description ||
        existingProduct.metadata?.revealui_track !== productDef.billingModel ||
        existingProduct.metadata?.revealui_tier !== productDef.tier ||
        existingProduct.metadata?.revealui_price_note !== productDef.priceNote ||
        existingProduct.metadata?.revealui_renewal !== productDef.renewal ||
        productTaxCode(existingProduct) !== PRODUCT_TAX_CODE
      ) {
        if (dryRun) {
          log.info(`Would update product: ${existingProduct.id}`);
          product = existingProduct;
        } else {
          product = await stripe.products.update(existingProduct.id, {
            name: productDef.name,
            description: productDef.description,
            tax_code: PRODUCT_TAX_CODE,
            metadata: {
              revealui_product_key: productDef.key,
              revealui_track: productDef.billingModel,
              revealui_tier: productDef.tier,
              ...(productDef.priceNote && { revealui_price_note: productDef.priceNote }),
              ...(productDef.renewal && { revealui_renewal: productDef.renewal }),
            },
          });
          log.success(`Updated product: ${product.id}`);
        }
      } else {
        product = existingProduct;
        log.success(`Product exists: ${product.id} (no changes needed)`);
      }
    } else {
      if (dryRun) {
        log.info(`Would create product: ${productDef.name}`);
        continue;
      }
      product = await stripe.products.create({
        name: productDef.name,
        description: productDef.description,
        tax_code: PRODUCT_TAX_CODE,
        metadata: {
          revealui_product_key: productDef.key,
          revealui_track: productDef.billingModel,
          revealui_tier: productDef.tier,
          ...(productDef.priceNote && { revealui_price_note: productDef.priceNote }),
          ...(productDef.renewal && { revealui_renewal: productDef.renewal }),
        },
      });
      log.success(`Created product: ${product.id}`);
    }

    const existingPrices = await stripe.prices
      .list({ product: product.id, active: true })
      .autoPagingToArray({ limit: 10_000 });
    let defaultPriceId = product.default_price;
    const subscriptionPriceIds: string[] = [];
    const currentDefaultPriceId =
      typeof product.default_price === 'string' ? product.default_price : product.default_price?.id;
    const stalePricesToArchiveLast: string[] = [];

    for (const priceDef of productDef.prices) {
      const matchingPrice = existingPrices.find((p) => priceMatchesDefinition(p, priceDef));

      if (matchingPrice) {
        log.success(
          `  Price exists: ${matchingPrice.id} (${priceDef.key}: $${(priceDef.unitAmount / 100).toFixed(2)}${priceDef.interval ? `/${priceDef.interval}` : ''})`,
        );
        if (PRICE_ENV_KEYS[priceDef.key]) {
          envVars[PRICE_ENV_KEYS[priceDef.key]] = matchingPrice.id;
        }
        if (PRICE_SERVER_ENV_KEYS[priceDef.key]) {
          envVars[PRICE_SERVER_ENV_KEYS[priceDef.key]] = matchingPrice.id;
        }
        if (priceDef.mode === 'subscription') {
          subscriptionPriceIds.push(matchingPrice.id);
        }
        if (priceDef.key === productDef.defaultPriceKey) {
          defaultPriceId = matchingPrice.id;
        }
        continue;
      }

      // Archive stale price with same key but different amount/interval
      const stalePrice = existingPrices.find((p) => priceSharesHandle(p, priceDef));
      if (stalePrice) {
        if (dryRun) {
          log.info(`  Would archive stale price: ${stalePrice.id}`);
        } else if (stalePrice.id === currentDefaultPriceId) {
          stalePricesToArchiveLast.push(stalePrice.id);
        } else {
          await stripe.prices.update(stalePrice.id, { active: false });
          log.warn(`  Archived stale price: ${stalePrice.id}`);
        }
      }

      if (dryRun) {
        log.info(
          `  Would create price: ${priceDef.key} ($${(priceDef.unitAmount / 100).toFixed(2)}${priceDef.interval ? `/${priceDef.interval}` : ''})`,
        );
        continue;
      }

      const priceParams: Stripe.PriceCreateParams = {
        product: product.id,
        unit_amount: priceDef.unitAmount,
        currency: priceDef.currency,
        // Stripe's purpose-built stable handle. transfer_lookup_key moves it off
        // an archived/stale price (a changed amount archives + recreates, since
        // prices are immutable) onto the new price so the handle survives.
        lookup_key: priceDef.key,
        transfer_lookup_key: true,
        metadata: { revealui_price_key: priceDef.key },
        tax_behavior: PRICE_TAX_BEHAVIOR,
      };

      if (priceDef.mode === 'subscription') {
        if (!priceDef.interval) {
          throw new Error(`Subscription price "${priceDef.key}" is missing an interval`);
        }

        priceParams.recurring = {
          interval: priceDef.interval,
          trial_period_days: priceDef.trialDays,
        };
      }

      const price = await stripe.prices.create(priceParams);

      log.success(
        `  Created price: ${price.id} (${priceDef.key}: $${(priceDef.unitAmount / 100).toFixed(2)}${priceDef.interval ? `/${priceDef.interval}` : ''})`,
      );

      if (PRICE_ENV_KEYS[priceDef.key]) {
        envVars[PRICE_ENV_KEYS[priceDef.key]] = price.id;
      }
      if (PRICE_SERVER_ENV_KEYS[priceDef.key]) {
        envVars[PRICE_SERVER_ENV_KEYS[priceDef.key]] = price.id;
      }
      if (priceDef.mode === 'subscription') {
        subscriptionPriceIds.push(price.id);
      }
      if (priceDef.key === productDef.defaultPriceKey) {
        defaultPriceId = price.id;
      }
    }

    if (defaultPriceId && currentDefaultPriceId !== defaultPriceId) {
      if (dryRun) {
        log.info(`  Would set default price: ${defaultPriceId}`);
      } else {
        await stripe.products.update(product.id, { default_price: String(defaultPriceId) });
        log.success(`  Set default price: ${defaultPriceId}`);
        for (const staleId of stalePricesToArchiveLast) {
          await stripe.prices.update(staleId, { active: false });
          log.warn(`  Archived stale price (was default): ${staleId}`);
        }
      }
    }

    if (productDef.billingModel === 'subscription') {
      subscriptionProducts.push({
        productId: product.id,
        priceIds: subscriptionPriceIds,
      });
    }

    if (defaultPriceId) {
      const planId =
        productDef.billingModel === 'credits' && productDef.creditBundleName
          ? `credits:${productDef.creditBundleName}`
          : `${productDef.billingModel}:${productDef.tier}`;
      catalogEntries.push({
        planId,
        tier: productDef.tier,
        billingModel: productDef.billingModel,
        stripeProductId: product.id,
        stripePriceId: String(defaultPriceId),
      });
    }
  }

  return { envVars, subscriptionProducts, catalogEntries };
}

// ─── Webhook Endpoint ────────────────────────────────────────────────────────

async function setupWebhookEndpoint(
  url: string,
  stripe: Stripe,
  dryRun: boolean,
): Promise<string | null> {
  log.info('');
  log.info(`Webhook URL: ${url}`);

  const allEndpoints = await stripe.webhookEndpoints.list().autoPagingToArray({ limit: 10_000 });
  const match = allEndpoints.find((e) => e.url === url);

  if (match) {
    const currentEvents = new Set(match.enabled_events);
    const wantedEvents = new Set(WEBHOOK_EVENTS);
    const needsUpdate =
      WEBHOOK_EVENTS.some((e) => !currentEvents.has(e)) ||
      [...currentEvents].some(
        (e) => e !== '*' && !wantedEvents.has(e as (typeof WEBHOOK_EVENTS)[number]),
      );

    if (needsUpdate) {
      if (dryRun) {
        log.info(`Would update webhook endpoint: ${match.id}`);
      } else {
        await stripe.webhookEndpoints.update(match.id, { enabled_events: WEBHOOK_EVENTS });
        log.success(`Updated webhook endpoint: ${match.id}`);
      }
    } else {
      log.success(`Webhook endpoint exists: ${match.id} (no changes needed)`);
    }
    // Secret is only returned on creation; use existing env var if already set
    if (process.env.STRIPE_WEBHOOK_SECRET) {
      log.info('  STRIPE_WEBHOOK_SECRET already set in env  -  skipping output');
    } else {
      log.warn(
        '  Webhook endpoint exists but STRIPE_WEBHOOK_SECRET not in env  -  retrieve it from the Stripe dashboard',
      );
    }
    return null;
  }

  if (dryRun) {
    log.info(`Would create webhook endpoint for: ${url}`);
    log.info(`  Events: ${WEBHOOK_EVENTS.join(', ')}`);
    return null;
  }

  const endpoint = await stripe.webhookEndpoints.create({
    url,
    enabled_events: WEBHOOK_EVENTS,
    api_version: StripeConstructor.API_VERSION,
  });

  log.success(`Created webhook endpoint: ${endpoint.id}`);
  return endpoint.secret ?? null;
}

// ─── Billing Portal ──────────────────────────────────────────────────────────

async function setupBillingPortal(
  stripe: Stripe,
  subscriptionProducts: Array<{ productId: string; priceIds: string[] }>,
  dryRun: boolean,
): Promise<void> {
  log.info('');
  log.info('Setting up billing portal configuration...');

  const allConfigs = await stripe.billingPortal.configurations
    .list()
    .autoPagingToArray({ limit: 10_000 });
  const seedCreated = allConfigs.find((c) => c.metadata?.revealui_portal === 'true');
  const currentDefault = allConfigs.find((c) => c.is_default === true);

  // Drift detection: warn if the current default is NOT the seed-managed one.
  // This was the CR-8 audit finding  -  a non-seed-managed config was default
  // in test mode, missing subscription_update (customers couldn't self-serve
  // plan switches). Warn loudly so the operator archives/reassigns in dashboard.
  if (currentDefault && currentDefault.metadata?.revealui_portal !== 'true') {
    log.warn(
      `Default billing portal config (${currentDefault.id}) was NOT created by this script.`,
    );
    log.warn(`  Its features may differ from the canonical set below. Review in Stripe dashboard:`);
    log.warn(`    https://dashboard.stripe.com/settings/billing/portal`);
    log.warn(`  Recommendation: archive it and select the seed-managed config as default.`);
  }

  // Canonical feature set  -  all five portal capabilities enabled.
  // The pre-CR-8 default had subscription_update disabled, blocking customer
  // self-serve plan switches. Customers should be able to fully manage their
  // account from the portal without contacting support.
  const portalFeatures: Stripe.BillingPortal.ConfigurationCreateParams.Features = {
    customer_update: {
      enabled: true,
      // `email` intentionally omitted — RevealUI uses email as auth identity,
      // and portal-editing it would drift from the auth session.
      allowed_updates: ['address', 'name', 'phone', 'shipping', 'tax_id'],
    },
    subscription_cancel: { enabled: true, mode: 'at_period_end' },
    subscription_update: {
      enabled: true,
      default_allowed_updates: ['price'],
      proration_behavior: 'create_prorations',
      products: subscriptionProducts.map((product) => ({
        product: product.productId,
        prices: product.priceIds,
      })),
    },
    invoice_history: { enabled: true },
    payment_method_update: { enabled: true },
  };

  if (seedCreated) {
    if (dryRun) {
      log.info(`Would update billing portal config: ${seedCreated.id}`);
    } else {
      await stripe.billingPortal.configurations.update(seedCreated.id, {
        features: portalFeatures,
      });
      log.success(`Updated billing portal config: ${seedCreated.id}`);
    }
    if (seedCreated.is_default === false) {
      log.warn(
        `Seed-managed config ${seedCreated.id} is NOT the account default. Select it in Stripe dashboard:`,
      );
      log.warn(`    https://dashboard.stripe.com/settings/billing/portal`);
    }
    return;
  }

  if (dryRun) {
    log.info('Would create billing portal configuration');
    log.info(
      `  Products for plan switching: ${subscriptionProducts
        .map((product) => product.productId)
        .join(', ')}`,
    );
    log.info(
      `  Features enabled: customer_update, subscription_cancel, subscription_update, invoice_history, payment_method_update`,
    );
    return;
  }

  const portalConfig = await stripe.billingPortal.configurations.create({
    features: portalFeatures,
    business_profile: {
      headline: 'Manage your RevealUI subscription',
    },
    metadata: { revealui_portal: 'true' },
  });

  log.success(`Created billing portal config: ${portalConfig.id}`);
  log.warn(`ACTION REQUIRED: select this config as the default customer portal.`);
  log.warn(`  Stripe API does not expose default-config selection — dashboard-only:`);
  log.warn(`    https://dashboard.stripe.com/settings/billing/portal`);
  log.warn(
    `  Then archive any other portal configurations that are not the seed-managed one (metadata.revealui_portal='true').`,
  );
}

// ─── Vercel Sync ─────────────────────────────────────────────────────────────

async function syncToVercel(envVars: Record<string, string>): Promise<void> {
  const token = process.env.VERCEL_TOKEN;
  if (!token) {
    log.error('STRIPE_SYNC_VERCEL requires VERCEL_TOKEN in env');
    return;
  }

  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!projectId) {
    log.warn('VERCEL_PROJECT_ID not set  -  run `vercel link` first or set it manually');
    log.warn('Skipping Vercel sync');
    return;
  }

  log.info('');
  log.info('Syncing env vars to Vercel...');

  // Get existing env vars to skip unchanged ones
  let existingEnv: Record<string, string> = {};
  try {
    const result = execFileSync('vercel', ['env', 'ls', '--json'], {
      env: { ...process.env, VERCEL_TOKEN: token },
      encoding: 'utf-8',
    });
    const parsed = JSON.parse(result) as Array<{ key: string; value?: string }>;
    for (const entry of parsed) {
      if (entry.key && entry.value) {
        existingEnv[entry.key] = entry.value;
      }
    }
  } catch {
    log.warn('Could not fetch existing Vercel env vars  -  will attempt to set all');
    existingEnv = {};
  }

  for (const [key, value] of Object.entries(envVars)) {
    if (existingEnv[key] === value) {
      log.success(`  ${key} already up to date`);
      continue;
    }
    try {
      execFileSync('vercel', ['env', 'add', key, 'production'], {
        input: value,
        env: { ...process.env, VERCEL_TOKEN: token },
        encoding: 'utf-8',
      });
      log.success(`  Set ${key} in Vercel production`);
    } catch (err) {
      log.error(`  Failed to set ${key}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

async function syncBillingCatalog(envVars: Record<string, string>, dryRun: boolean): Promise<void> {
  if (dryRun) {
    log.info('Would sync billing_catalog from the resolved Stripe price IDs');
    return;
  }

  log.info('');
  log.info('Syncing local billing_catalog...');

  try {
    execFileSync('pnpm', ['billing:catalog:sync'], {
      env: { ...process.env, ...envVars },
      stdio: 'inherit',
      cwd: resolve(import.meta.dirname, '../..'),
    });
    log.success('billing_catalog synced');
  } catch (err) {
    log.error(
      `Failed to sync billing_catalog: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

async function writeLocalStripeEnvCache(
  envVars: Record<string, string>,
  catalogEntries: LocalStripeCatalogCache['catalogEntries'],
  dryRun: boolean,
): Promise<void> {
  if (dryRun || Object.keys(envVars).length === 0) {
    return;
  }

  await mkdir(dirname(LOCAL_STRIPE_ENV_CACHE_PATH), { recursive: true });
  await writeFile(
    LOCAL_STRIPE_ENV_CACHE_PATH,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        envVars,
        catalogEntries,
      } satisfies LocalStripeCatalogCache,
      null,
      2,
    ),
    'utf8',
  );
  log.success(`Cached Stripe env vars at ${LOCAL_STRIPE_ENV_CACHE_PATH}`);
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const skipWebhook = args.includes('--skip-webhook');
  const skipPortal = args.includes('--skip-portal');
  const skipCatalogSync = args.includes('--skip-catalog-sync');
  const syncVercel = args.includes('--sync-vercel');
  const syncRevvault = args.includes('--sync-revvault');
  const webhookUrlFlag = (() => {
    const idx = args.indexOf('--webhook-url');
    return idx !== -1 ? args[idx + 1] : undefined;
  })();

  log.header('RevealUI Stripe IaC Seed');

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    log.error('STRIPE_SECRET_KEY is not set. Add it to .env');
    process.exit(1);
  }

  if (!(secretKey.startsWith('sk_test_') || secretKey.startsWith('sk_live_'))) {
    log.error('STRIPE_SECRET_KEY must start with sk_test_ or sk_live_');
    process.exit(1);
  }

  if (secretKey.startsWith('sk_live_')) {
    log.warn('Using LIVE Stripe key  -  resources will be created in production!');
    log.info('Press Ctrl+C within 5 seconds to abort...');
    await new Promise((r) => setTimeout(r, 5000));
  }

  if (dryRun) {
    log.info('DRY RUN  -  no changes will be made to Stripe');
  }

  const stripe = new StripeConstructor(secretKey, { apiVersion: StripeConstructor.API_VERSION });

  try {
    await stripe.balance.retrieve();
    log.success('Connected to Stripe');
  } catch (err) {
    log.error(`Failed to connect to Stripe: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  // ── Stripe Billing Meter (Track B agent task overage)
  log.header('Stripe Billing Meter');
  await ensureBillingMeter(stripe, dryRun);

  // ── Products & prices
  log.header('Products & Prices');
  const { envVars, subscriptionProducts, catalogEntries } = await syncCatalog(stripe, dryRun);
  envVars.STRIPE_AGENT_METER_EVENT_NAME = AGENT_METER_EVENT_NAME;

  await writeLocalStripeEnvCache(envVars, catalogEntries, dryRun);

  // ── Webhook endpoint
  if (!skipWebhook) {
    log.header('Webhook Endpoint');
    const apiUrl = webhookUrlFlag ?? process.env.API_URL;
    // Trim a single trailing slash without regex (no-regex hardline).
    const trimmedApiUrl = apiUrl && apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl;
    const webhookUrl = trimmedApiUrl ? `${trimmedApiUrl}/api/webhooks/stripe` : undefined;

    if (!webhookUrl) {
      log.warn('No webhook URL  -  set API_URL in .env or pass --webhook-url URL');
      log.warn('Skipping webhook endpoint setup');
    } else if (!dryRun && isLocalWebhookUrl(webhookUrl)) {
      log.warn('Skipping webhook endpoint setup for local-only URL');
      log.info('Use Stripe CLI or a public tunnel if you need local webhook delivery');
    } else {
      const webhookSecret = await setupWebhookEndpoint(webhookUrl, stripe, dryRun);
      if (webhookSecret) {
        envVars.STRIPE_WEBHOOK_SECRET = webhookSecret;
      }
    }
  }

  // ── Billing portal
  if (!skipPortal && subscriptionProducts.length > 0) {
    log.header('Billing Portal');
    await setupBillingPortal(stripe, subscriptionProducts, dryRun);
  }

  // ── Output env vars
  if (Object.keys(envVars).length > 0) {
    log.header('Env Vars  -  Add to .env');
    for (const [key, value] of Object.entries(envVars)) {
      log.env(key, value);
    }

    if (!skipCatalogSync) {
      log.header('Billing Catalog');
      await syncBillingCatalog(envVars, dryRun);
    }

    if (syncRevvault) {
      log.header('Revvault Sync (source of truth)');
      const revvaultResult = syncToRevvault(envVars, {
        manifestPath: resolve(import.meta.dirname, '../sync/revvault-vercel.toml'),
        dryRun,
        log,
      });
      log.info(
        `revvault: ${revvaultResult.written.length} written, ${revvaultResult.skipped.length} skipped (no manifest path), ${revvaultResult.failed.length} failed`,
      );
      if (revvaultResult.failed.length > 0) {
        process.exitCode = 1;
      } else if (!dryRun) {
        log.info('Next: review + commit the passage-store, then `revvault sync vercel --apply`');
      }
    }

    if (syncVercel) {
      log.header('Vercel Sync');
      log.warn(
        '--sync-vercel is DEPRECATED (writes Vercel behind revvault). Prefer --sync-revvault, then `revvault sync vercel --apply`.',
      );
      await syncToVercel(envVars);
    }
  }

  log.info('');
  log.success('Done!');
}

main().catch((err) => {
  log.error(`Fatal: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
