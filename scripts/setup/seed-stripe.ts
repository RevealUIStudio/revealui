#!/usr/bin/env tsx

/**
 * Stripe Infrastructure-as-Code Seed Script
 *
 * Declares RevealUI's full Stripe configuration as code and syncs it idempotently:
 *   - Products & prices (Pro, Max, Enterprise)
 *   - Webhook endpoint (with canonical event list)
 *   - Billing portal configuration (plan switching, cancellation, invoice history)
 *
 * Idempotent — safe to run multiple times. Uses metadata keys for deduplication.
 *
 * Usage:
 *   pnpm stripe:seed                         # sync all (products + webhook + portal)
 *   pnpm stripe:seed -- --dry-run            # preview, no writes
 *   pnpm stripe:seed -- --skip-webhook       # skip webhook endpoint setup
 *   pnpm stripe:seed -- --skip-portal        # skip billing portal setup
 *   pnpm stripe:seed -- --skip-catalog-sync  # skip local billing_catalog sync
 *   pnpm stripe:seed -- --webhook-url URL    # override webhook URL
 *   pnpm stripe:seed -- --sync-vercel        # push price IDs to Vercel env
 */

import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { config } from 'dotenv';

// Load env from root .env
config({ path: resolve(import.meta.dirname, '../../.env') });

// Stripe is installed in packages/services — resolve from there
const require = createRequire(resolve(import.meta.dirname, '../../packages/services/'));
const Stripe = require('stripe').default as typeof import('stripe').default;

// ─── Product Catalog ────────────────────────────────────────────────────────

interface ProductDefinition {
  key: string;
  name: string;
  description: string;
  prices: PriceDefinition[];
}

interface PriceDefinition {
  key: string;
  unitAmount: number; // cents
  currency: string;
  interval: 'month' | 'year';
  trialDays?: number;
}

const CATALOG: ProductDefinition[] = [
  {
    key: 'revealui_pro',
    name: 'RevealUI Pro',
    description:
      'AI agents, MCP servers, editor integrations, and advanced sync. For professional developers and small teams.',
    prices: [
      {
        key: 'revealui_pro_monthly',
        unitAmount: 4900,
        currency: 'usd',
        interval: 'month',
        trialDays: 7,
      },
      {
        key: 'revealui_pro_yearly',
        unitAmount: 47000,
        currency: 'usd',
        interval: 'year',
        trialDays: 7,
      },
    ],
  },
  {
    key: 'revealui_max',
    name: 'RevealUI Max',
    description:
      'AI memory, BYOK server-side, multi-provider AI, audit log, and higher limits (15 projects, 100 users).',
    prices: [
      {
        key: 'revealui_max_monthly',
        unitAmount: 14900,
        currency: 'usd',
        interval: 'month',
        trialDays: 7,
      },
      {
        key: 'revealui_max_yearly',
        unitAmount: 142800,
        currency: 'usd',
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
    prices: [
      {
        key: 'revealui_enterprise_monthly',
        unitAmount: 29900,
        currency: 'usd',
        interval: 'month',
      },
      {
        key: 'revealui_enterprise_yearly',
        unitAmount: 287000,
        currency: 'usd',
        interval: 'year',
      },
    ],
  },
];

// Canonical webhook events — must mirror `relevantEvents` in apps/api/src/routes/webhooks.ts
const WEBHOOK_EVENTS: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_failed',
  'invoice.payment_succeeded',
  'payment_intent.payment_failed',
  'customer.subscription.trial_will_end',
  'charge.dispute.closed',
  'charge.dispute.created',
  'charge.refunded',
];

// Env vars to track: public-facing price IDs + server-side aliases
const PRICE_ENV_KEYS: Record<string, string> = {
  revealui_pro_monthly: 'NEXT_PUBLIC_STRIPE_PRO_PRICE_ID',
  revealui_max_monthly: 'NEXT_PUBLIC_STRIPE_MAX_PRICE_ID',
  revealui_enterprise_monthly: 'NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID',
};
const PRICE_SERVER_ENV_KEYS: Record<string, string> = {
  revealui_pro_monthly: 'STRIPE_PRO_PRICE_ID',
  revealui_max_monthly: 'STRIPE_MAX_PRICE_ID',
  revealui_enterprise_monthly: 'STRIPE_ENTERPRISE_PRICE_ID',
};

// ─── Logger ─────────────────────────────────────────────────────────────────

const log = {
  header: (msg: string) => console.log(`\n${'═'.repeat(60)}\n  ${msg}\n${'═'.repeat(60)}`),
  info: (msg: string) => console.log(`  i ${msg}`),
  success: (msg: string) => console.log(`  ✓ ${msg}`),
  warn: (msg: string) => console.log(`  ! ${msg}`),
  error: (msg: string) => console.error(`  ✗ ${msg}`),
  env: (key: string, value: string) => console.log(`\n  ${key}=${value}`),
};

// ─── Products & Prices ───────────────────────────────────────────────────────

async function syncCatalog(
  stripe: Stripe,
  dryRun: boolean,
): Promise<{ envVars: Record<string, string>; productIds: string[] }> {
  const envVars: Record<string, string> = {};
  const productIds: string[] = [];

  for (const productDef of CATALOG) {
    log.info('');
    log.info(`Processing: ${productDef.name} (${productDef.key})`);

    const existing = await stripe.products.list({ limit: 100, active: true });
    const existingProduct = existing.data.find(
      (p) => p.metadata.revealui_product_key === productDef.key,
    );

    let product: Stripe.Product;

    if (existingProduct) {
      if (
        existingProduct.name !== productDef.name ||
        existingProduct.description !== productDef.description
      ) {
        if (dryRun) {
          log.info(`Would update product: ${existingProduct.id}`);
          product = existingProduct;
        } else {
          product = await stripe.products.update(existingProduct.id, {
            name: productDef.name,
            description: productDef.description,
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
        metadata: { revealui_product_key: productDef.key },
      });
      log.success(`Created product: ${product.id}`);
    }

    productIds.push(product.id);

    const existingPrices = await stripe.prices.list({
      product: product.id,
      active: true,
      limit: 100,
    });

    for (const priceDef of productDef.prices) {
      const matchingPrice = existingPrices.data.find(
        (p) =>
          p.metadata.revealui_price_key === priceDef.key &&
          p.unit_amount === priceDef.unitAmount &&
          p.currency === priceDef.currency &&
          p.recurring?.interval === priceDef.interval,
      );

      if (matchingPrice) {
        log.success(
          `  Price exists: ${matchingPrice.id} (${priceDef.key}: $${(priceDef.unitAmount / 100).toFixed(2)}/${priceDef.interval})`,
        );
        if (PRICE_ENV_KEYS[priceDef.key]) {
          envVars[PRICE_ENV_KEYS[priceDef.key]] = matchingPrice.id;
        }
        if (PRICE_SERVER_ENV_KEYS[priceDef.key]) {
          envVars[PRICE_SERVER_ENV_KEYS[priceDef.key]] = matchingPrice.id;
        }
        continue;
      }

      // Archive stale price with same key but different amount/interval
      const stalePrice = existingPrices.data.find(
        (p) => p.metadata.revealui_price_key === priceDef.key,
      );
      if (stalePrice) {
        if (dryRun) {
          log.info(`  Would archive stale price: ${stalePrice.id}`);
        } else {
          await stripe.prices.update(stalePrice.id, { active: false });
          log.warn(`  Archived stale price: ${stalePrice.id}`);
        }
      }

      if (dryRun) {
        log.info(
          `  Would create price: ${priceDef.key} ($${(priceDef.unitAmount / 100).toFixed(2)}/${priceDef.interval})`,
        );
        continue;
      }

      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: priceDef.unitAmount,
        currency: priceDef.currency,
        recurring: { interval: priceDef.interval, trial_period_days: priceDef.trialDays },
        metadata: { revealui_price_key: priceDef.key },
      });

      log.success(
        `  Created price: ${price.id} (${priceDef.key}: $${(priceDef.unitAmount / 100).toFixed(2)}/${priceDef.interval})`,
      );

      if (PRICE_ENV_KEYS[priceDef.key]) {
        envVars[PRICE_ENV_KEYS[priceDef.key]] = price.id;
      }
      if (PRICE_SERVER_ENV_KEYS[priceDef.key]) {
        envVars[PRICE_SERVER_ENV_KEYS[priceDef.key]] = price.id;
      }
    }
  }

  return { envVars, productIds };
}

// ─── Webhook Endpoint ────────────────────────────────────────────────────────

async function setupWebhookEndpoint(
  url: string,
  stripe: Stripe,
  dryRun: boolean,
): Promise<string | null> {
  log.info('');
  log.info(`Webhook URL: ${url}`);

  const existing = await stripe.webhookEndpoints.list({ limit: 100 });
  const match = existing.data.find((e) => e.url === url);

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
      log.info('  STRIPE_WEBHOOK_SECRET already set in env — skipping output');
    } else {
      log.warn(
        '  Webhook endpoint exists but STRIPE_WEBHOOK_SECRET not in env — retrieve it from the Stripe dashboard',
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
    api_version: '2026-01-28.clover',
  });

  log.success(`Created webhook endpoint: ${endpoint.id}`);
  return endpoint.secret ?? null;
}

// ─── Billing Portal ──────────────────────────────────────────────────────────

async function setupBillingPortal(
  stripe: Stripe,
  productIds: string[],
  dryRun: boolean,
): Promise<void> {
  log.info('');
  log.info('Setting up billing portal configuration...');

  const existing = await stripe.billingPortal.configurations.list({ limit: 100 });
  const match = existing.data.find((c) => c.metadata?.revealui_portal === 'true');

  // Build the features config with all products for plan switching
  const subscriptionUpdateProducts = productIds.map((id) => ({ product: id }));

  const portalFeatures: Stripe.BillingPortal.ConfigurationCreateParams.Features = {
    subscription_cancel: { enabled: true, mode: 'at_period_end' },
    subscription_update: {
      enabled: true,
      default_allowed_updates: ['price'],
      proration_behavior: 'create_prorations',
      products: subscriptionUpdateProducts.map((p) => ({
        product: p.product,
        prices: [],
      })),
    },
    invoice_history: { enabled: true },
    payment_method_update: { enabled: true },
  };

  if (match) {
    if (dryRun) {
      log.info(`Would update billing portal config: ${match.id}`);
    } else {
      await stripe.billingPortal.configurations.update(match.id, {
        features: portalFeatures,
        is_default: true,
      });
      log.success(`Updated billing portal config: ${match.id} (set as default)`);
    }
    return;
  }

  if (dryRun) {
    log.info('Would create billing portal configuration');
    log.info(`  Products for plan switching: ${productIds.join(', ')}`);
    return;
  }

  const portalConfig = await stripe.billingPortal.configurations.create({
    features: portalFeatures,
    business_profile: {
      headline: 'Manage your RevealUI subscription',
    },
    metadata: { revealui_portal: 'true' },
  });

  // Set as default
  await stripe.billingPortal.configurations.update(portalConfig.id, { is_default: true });

  log.success(`Created billing portal config: ${portalConfig.id} (set as default)`);
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
    log.warn('VERCEL_PROJECT_ID not set — run `vercel link` first or set it manually');
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
    log.warn('Could not fetch existing Vercel env vars — will attempt to set all');
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

// ─── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const skipWebhook = args.includes('--skip-webhook');
  const skipPortal = args.includes('--skip-portal');
  const skipCatalogSync = args.includes('--skip-catalog-sync');
  const syncVercel = args.includes('--sync-vercel');
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
    log.warn('Using LIVE Stripe key — resources will be created in production!');
    log.info('Press Ctrl+C within 5 seconds to abort...');
    await new Promise((r) => setTimeout(r, 5000));
  }

  if (dryRun) {
    log.info('DRY RUN — no changes will be made to Stripe');
  }

  const stripe = new Stripe(secretKey, { apiVersion: '2026-01-28.clover' });

  try {
    await stripe.balance.retrieve();
    log.success('Connected to Stripe');
  } catch (err) {
    log.error(`Failed to connect to Stripe: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  // ── Products & prices
  log.header('Products & Prices');
  const { envVars, productIds } = await syncCatalog(stripe, dryRun);

  // ── Webhook endpoint
  if (!skipWebhook) {
    log.header('Webhook Endpoint');
    const apiUrl = webhookUrlFlag ?? process.env.API_URL;
    const webhookUrl = apiUrl ? `${apiUrl.replace(/\/$/, '')}/api/webhooks/stripe` : undefined;

    if (!webhookUrl) {
      log.warn('No webhook URL — set API_URL in .env or pass --webhook-url URL');
      log.warn('Skipping webhook endpoint setup');
    } else {
      const webhookSecret = await setupWebhookEndpoint(webhookUrl, stripe, dryRun);
      if (webhookSecret) {
        envVars.STRIPE_WEBHOOK_SECRET = webhookSecret;
      }
    }
  }

  // ── Billing portal
  if (!skipPortal && productIds.length > 0) {
    log.header('Billing Portal');
    await setupBillingPortal(stripe, productIds, dryRun);
  }

  // ── Output env vars
  if (Object.keys(envVars).length > 0) {
    log.header('Env Vars — Add to .env');
    for (const [key, value] of Object.entries(envVars)) {
      log.env(key, value);
    }

    if (!skipCatalogSync) {
      log.header('Billing Catalog');
      await syncBillingCatalog(envVars, dryRun);
    }

    if (syncVercel) {
      log.header('Vercel Sync');
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
