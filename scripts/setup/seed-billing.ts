#!/usr/bin/env tsx

/**
 * Seed the billing_catalog table with default subscription and perpetual plans.
 *
 * Idempotent: uses INSERT ON CONFLICT (plan_id) DO UPDATE to upsert.
 * Run via: pnpm db:seed:billing
 *
 * Stripe product/price IDs are read from environment variables.
 * If not set, rows are created with null stripe IDs (manual Stripe setup required).
 *
 * @dependencies
 * - @revealui/db - Database client and billing_catalog schema
 * - dotenv - Environment variable loading
 *
 * @requires
 * - Environment: DATABASE_URL or POSTGRES_URL (via dotenv)
 * - Optional: STRIPE_*_PRODUCT_ID and STRIPE_*_PRICE_ID env vars
 */

import { resolve } from 'node:path';
import { getClient } from '@revealui/db';
import { billingCatalog } from '@revealui/db/schema';
import { config } from 'dotenv';

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

const rootDir = resolve(import.meta.dirname, '../..');

for (const envFile of [
  '.env',
  '.env.development.local',
  '.env.local',
  'apps/admin/.env.local',
  'apps/marketing/.env.local',
  'apps/api/.env.vercel',
]) {
  config({ path: resolve(rootDir, envFile), override: false });
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PaidTier = 'pro' | 'max' | 'enterprise';
type BillingModel = 'subscription' | 'perpetual' | 'credits';

interface CatalogPlan {
  planId: string;
  tier: PaidTier;
  billingModel: BillingModel;
  stripeProductIdEnv: string;
  stripePriceIdEnv: string;
}

// ---------------------------------------------------------------------------
// Plan definitions
// ---------------------------------------------------------------------------

const CATALOG_PLANS: CatalogPlan[] = [
  // Subscription plans
  {
    planId: 'subscription:pro',
    tier: 'pro',
    billingModel: 'subscription',
    stripeProductIdEnv: 'STRIPE_PRO_PRODUCT_ID',
    stripePriceIdEnv: 'STRIPE_PRO_PRICE_ID',
  },
  {
    planId: 'subscription:max',
    tier: 'max',
    billingModel: 'subscription',
    stripeProductIdEnv: 'STRIPE_MAX_PRODUCT_ID',
    stripePriceIdEnv: 'STRIPE_MAX_PRICE_ID',
  },
  {
    planId: 'subscription:enterprise',
    tier: 'enterprise',
    billingModel: 'subscription',
    stripeProductIdEnv: 'STRIPE_ENTERPRISE_PRODUCT_ID',
    stripePriceIdEnv: 'STRIPE_ENTERPRISE_PRICE_ID',
  },
  // Perpetual plans
  {
    planId: 'perpetual:pro',
    tier: 'pro',
    billingModel: 'perpetual',
    stripeProductIdEnv: 'STRIPE_PERPETUAL_PRO_PRODUCT_ID',
    stripePriceIdEnv: 'STRIPE_PERPETUAL_PRO_PRICE_ID',
  },
  {
    planId: 'perpetual:max',
    tier: 'max',
    billingModel: 'perpetual',
    stripeProductIdEnv: 'STRIPE_PERPETUAL_MAX_PRODUCT_ID',
    stripePriceIdEnv: 'STRIPE_PERPETUAL_MAX_PRICE_ID',
  },
  {
    planId: 'perpetual:enterprise',
    tier: 'enterprise',
    billingModel: 'perpetual',
    stripeProductIdEnv: 'STRIPE_PERPETUAL_ENTERPRISE_PRODUCT_ID',
    stripePriceIdEnv: 'STRIPE_PERPETUAL_ENTERPRISE_PRICE_ID',
  },
  // Credit bundles (Track B)
  {
    planId: 'credits:starter',
    tier: 'pro',
    billingModel: 'credits',
    stripeProductIdEnv: 'STRIPE_CREDITS_STARTER_PRODUCT_ID',
    stripePriceIdEnv: 'STRIPE_CREDITS_STARTER_PRICE_ID',
  },
  {
    planId: 'credits:standard',
    tier: 'pro',
    billingModel: 'credits',
    stripeProductIdEnv: 'STRIPE_CREDITS_STANDARD_PRODUCT_ID',
    stripePriceIdEnv: 'STRIPE_CREDITS_STANDARD_PRICE_ID',
  },
  {
    planId: 'credits:scale',
    tier: 'pro',
    billingModel: 'credits',
    stripeProductIdEnv: 'STRIPE_CREDITS_SCALE_PRODUCT_ID',
    stripePriceIdEnv: 'STRIPE_CREDITS_SCALE_PRICE_ID',
  },
];

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

const log = {
  header: (msg: string) => console.log(`\n${'='.repeat(60)}\n  ${msg}\n${'='.repeat(60)}`),
  info: (msg: string) => console.log(`  i ${msg}`),
  success: (msg: string) => console.log(`  + ${msg}`),
  warn: (msg: string) => console.log(`  ! ${msg}`),
  error: (msg: string) => console.error(`  x ${msg}`),
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  log.header('Seed billing_catalog');

  const db = getClient();
  const now = new Date();
  let seeded = 0;
  let withStripe = 0;
  let withoutStripe = 0;

  for (const plan of CATALOG_PLANS) {
    const stripeProductId = process.env[plan.stripeProductIdEnv] ?? null;
    const stripePriceId = process.env[plan.stripePriceIdEnv] ?? null;

    const values = {
      planId: plan.planId,
      tier: plan.tier,
      billingModel: plan.billingModel,
      stripeProductId,
      stripePriceId,
      active: true,
      metadata: {
        seededAt: now.toISOString(),
        stripeProductIdEnv: plan.stripeProductIdEnv,
        stripePriceIdEnv: plan.stripePriceIdEnv,
      },
      updatedAt: now,
    };

    await db
      .insert(billingCatalog)
      .values({
        id: crypto.randomUUID(),
        ...values,
        createdAt: now,
      })
      .onConflictDoUpdate({
        target: billingCatalog.planId,
        set: values,
      });

    const hasStripe = stripeProductId != null || stripePriceId != null;
    if (hasStripe) {
      withStripe++;
    } else {
      withoutStripe++;
    }

    log.success(
      `${plan.planId} (${plan.tier}/${plan.billingModel})${hasStripe ? '' : ' [no Stripe IDs]'}`,
    );
    seeded++;
  }

  log.info('');
  log.info(`Seeded: ${seeded} plan(s)`);
  log.info(`With Stripe IDs: ${withStripe}`);
  log.info(`Without Stripe IDs: ${withoutStripe}`);

  if (withoutStripe > 0) {
    log.warn(
      'Some plans have no Stripe IDs. Set the corresponding env vars and re-run, or use pnpm stripe:seed to create them in Stripe first.',
    );
  }

  log.success('Done');
}

try {
  await main();
} catch (error) {
  const pgCode = (error as { cause?: { code?: string } })?.cause?.code;

  if (pgCode === '42P01') {
    log.error('billing_catalog table does not exist.');
    log.info(
      'Run the account-entitlements database migration first, then re-run pnpm db:seed:billing.',
    );
    process.exit(1);
  }

  log.error(`Fatal: ${error instanceof Error ? error.message : String(error)}`);
  if (error instanceof Error && error.stack) {
    log.error(error.stack);
  }
  process.exit(1);
}
