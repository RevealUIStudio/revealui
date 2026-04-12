#!/usr/bin/env tsx

/**
 * Billing Catalog Validation Script (Phase 2.7  -  Stripe Go-Live Readiness)
 *
 * Validates that the billing_catalog table rows are consistent with:
 * 1. The contracts/pricing.ts tier definitions (single source of truth)
 * 2. The expected Stripe env vars (price IDs and product IDs)
 * 3. Internal consistency rules (no orphans, no duplicates, all tiers covered)
 *
 * Usage:
 *   pnpm validate:billing-catalog          # env-only mode (no DB needed)
 *   POSTGRES_URL="..." pnpm validate:billing-catalog --db   # full DB validation
 *
 * @dependencies
 * - @revealui/contracts/pricing - Tier definitions, limits, feature flags
 * - @revealui/scripts - Shared logging and output utilities
 */

import { type LicenseTierId, SUBSCRIPTION_TIERS, TIER_LIMITS } from '@revealui/contracts/pricing';
import { createLogger } from '@revealui/scripts/index.js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const PAID_TIERS: LicenseTierId[] = ['pro', 'max', 'enterprise'];
const BILLING_MODELS = ['subscription', 'perpetual'] as const;
const CREDIT_BUNDLES = ['starter', 'standard', 'scale'] as const;

/**
 * Expected env var names for each plan's Stripe price ID.
 * Maps planId → list of env var names to check (primary + legacy/public variants).
 */
const EXPECTED_PRICE_ENV_VARS: Record<string, string[]> = {
  'subscription:pro': ['STRIPE_PRO_PRICE_ID', 'NEXT_PUBLIC_STRIPE_PRO_PRICE_ID'],
  'subscription:max': ['STRIPE_MAX_PRICE_ID', 'NEXT_PUBLIC_STRIPE_MAX_PRICE_ID'],
  'subscription:enterprise': [
    'STRIPE_ENTERPRISE_PRICE_ID',
    'NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID',
  ],
  'perpetual:pro': ['STRIPE_PERPETUAL_PRO_PRICE_ID', 'NEXT_PUBLIC_STRIPE_PRO_PERPETUAL_PRICE_ID'],
  'perpetual:max': ['STRIPE_PERPETUAL_MAX_PRICE_ID', 'NEXT_PUBLIC_STRIPE_MAX_PERPETUAL_PRICE_ID'],
  'perpetual:enterprise': [
    'STRIPE_PERPETUAL_ENTERPRISE_PRICE_ID',
    'NEXT_PUBLIC_STRIPE_ENTERPRISE_PERPETUAL_PRICE_ID',
  ],
  // Credit bundles (Track B)
  'credits:starter': ['STRIPE_CREDITS_STARTER_PRICE_ID'],
  'credits:standard': ['STRIPE_CREDITS_STANDARD_PRICE_ID'],
  'credits:scale': ['STRIPE_CREDITS_SCALE_PRICE_ID'],
};

/** Every plan that should exist in the billing_catalog table */
const EXPECTED_PLAN_IDS = [
  ...PAID_TIERS.flatMap((tier) => BILLING_MODELS.map((model) => `${model}:${tier}`)),
  ...CREDIT_BUNDLES.map((bundle) => `credits:${bundle}`),
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ValidationResult {
  check: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
}

// ---------------------------------------------------------------------------
// Validation logic
// ---------------------------------------------------------------------------

const logger = createLogger({ prefix: 'billing-catalog' });
const results: ValidationResult[] = [];

function pass(check: string, message: string) {
  results.push({ check, status: 'pass', message });
  logger.success(`${check}: ${message}`);
}

function warn(check: string, message: string) {
  results.push({ check, status: 'warn', message });
  logger.warning(`${check}: ${message}`);
}

function fail(check: string, message: string) {
  results.push({ check, status: 'fail', message });
  logger.error(`${check}: ${message}`);
}

// ---------------------------------------------------------------------------
// 1. Contracts consistency checks (no DB needed)
// ---------------------------------------------------------------------------

function validateContracts() {
  logger.info('--- Contracts consistency ---');

  // 1a. All paid tiers have subscription tier entries
  for (const tier of PAID_TIERS) {
    const entry = SUBSCRIPTION_TIERS.find((t) => t.id === tier);
    if (entry) {
      pass('contracts-tier', `${tier} subscription tier defined`);
    } else {
      fail('contracts-tier', `${tier} missing from SUBSCRIPTION_TIERS`);
    }
  }

  // 1b. Free tier exists and has no price
  const freeTier = SUBSCRIPTION_TIERS.find((t) => t.id === 'free');
  if (freeTier) {
    if (!freeTier.price) {
      pass('contracts-free', 'Free tier has no price (correct)');
    } else {
      warn('contracts-free', `Free tier has price="${freeTier.price}" — should be undefined`);
    }
  } else {
    fail('contracts-free', 'Free tier missing from SUBSCRIPTION_TIERS');
  }

  // 1c. All tiers have limits defined
  for (const tier of ['free', ...PAID_TIERS] as LicenseTierId[]) {
    const limits = TIER_LIMITS[tier];
    if (limits) {
      pass(
        'contracts-limits',
        `${tier} limits defined (sites=${limits.sites ?? '∞'}, users=${limits.users ?? '∞'})`,
      );
    } else {
      fail('contracts-limits', `${tier} missing from TIER_LIMITS`);
    }
  }

  // 1d. Tier limits are monotonically increasing
  const orderedTiers: LicenseTierId[] = ['free', 'pro', 'max', 'enterprise'];
  for (let i = 1; i < orderedTiers.length; i++) {
    const prev = TIER_LIMITS[orderedTiers[i - 1]];
    const curr = TIER_LIMITS[orderedTiers[i]];
    if (!(prev && curr)) continue;

    const prevSites = prev.sites ?? Number.MAX_SAFE_INTEGER;
    const currSites = curr.sites ?? Number.MAX_SAFE_INTEGER;

    if (currSites >= prevSites) {
      pass(
        'contracts-monotonic',
        `${orderedTiers[i]} sites (${currSites === Number.MAX_SAFE_INTEGER ? '∞' : currSites}) >= ${orderedTiers[i - 1]} (${prevSites === Number.MAX_SAFE_INTEGER ? '∞' : prevSites})`,
      );
    } else {
      fail(
        'contracts-monotonic',
        `${orderedTiers[i]} sites (${currSites}) < ${orderedTiers[i - 1]} (${prevSites}) — limits must be monotonically increasing`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// 2. Environment variable checks
// ---------------------------------------------------------------------------

function validateEnvVars() {
  logger.info('--- Stripe env vars ---');

  // 2a. STRIPE_SECRET_KEY must be set
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (stripeKey) {
    if (stripeKey.startsWith('sk_test_')) {
      warn('stripe-key', 'STRIPE_SECRET_KEY is a test key  -  switch to live before go-live');
    } else if (stripeKey.startsWith('sk_live_')) {
      pass('stripe-key', 'STRIPE_SECRET_KEY is a live key');
    } else {
      warn('stripe-key', 'STRIPE_SECRET_KEY has unrecognized prefix');
    }
  } else {
    warn('stripe-key', 'STRIPE_SECRET_KEY not set  -  Stripe validation skipped');
  }

  // 2b. Check price ID env vars for each plan
  for (const planId of EXPECTED_PLAN_IDS) {
    const envVarNames = EXPECTED_PRICE_ENV_VARS[planId];
    if (!envVarNames) {
      fail('env-mapping', `No expected env var mapping for planId="${planId}"`);
      continue;
    }

    const found = envVarNames.find((name) => process.env[name]);
    if (found) {
      const value = process.env[found] ?? '';
      if (value.startsWith('price_')) {
        pass('env-price', `${planId}: ${found} = ${value.slice(0, 12)}...`);
      } else {
        warn(
          'env-price',
          `${planId}: ${found} = "${value.slice(0, 12)}..." — expected "price_" prefix`,
        );
      }
    } else {
      warn('env-price', `${planId}: none of [${envVarNames.join(', ')}] are set`);
    }
  }

  // 2c. Webhook secret
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (webhookSecret) {
    if (webhookSecret.startsWith('whsec_')) {
      pass('env-webhook', 'STRIPE_WEBHOOK_SECRET is set with correct prefix');
    } else {
      warn('env-webhook', 'STRIPE_WEBHOOK_SECRET has unexpected prefix');
    }
  } else {
    warn('env-webhook', 'STRIPE_WEBHOOK_SECRET not set');
  }
}

// ---------------------------------------------------------------------------
// 3. Database validation (optional  -  requires POSTGRES_URL)
// ---------------------------------------------------------------------------

async function validateDatabase() {
  logger.info('--- Database validation ---');

  // Dynamic imports to avoid ESM resolution issues when DB validation is skipped
  const drizzleOrm = await import('drizzle-orm');
  const { eq } = drizzleOrm;
  const { getClient } = await import('@revealui/db');
  const { billingCatalog } = await import('@revealui/db/schema');

  const db = getClient();

  // 3a. Fetch all catalog rows
  let rows: {
    planId: string;
    tier: string;
    billingModel: string;
    stripeProductId: string | null;
    stripePriceId: string | null;
    active: boolean;
  }[];

  try {
    rows = await db
      .select({
        planId: billingCatalog.planId,
        tier: billingCatalog.tier,
        billingModel: billingCatalog.billingModel,
        stripeProductId: billingCatalog.stripeProductId,
        stripePriceId: billingCatalog.stripePriceId,
        active: billingCatalog.active,
      })
      .from(billingCatalog);
  } catch (err) {
    const pgCode = (err as { cause?: { code?: string } })?.cause?.code;
    if (pgCode === '42P01') {
      fail('db-table', 'billing_catalog table does not exist  -  run migrations first');
      return;
    }
    fail(
      'db-connect',
      `Database query failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return;
  }

  pass('db-connect', `Loaded ${rows.length} billing_catalog rows`);

  // 3b. Every expected plan should have a row
  for (const planId of EXPECTED_PLAN_IDS) {
    const row = rows.find((r) => r.planId === planId);
    if (row) {
      pass('db-plan-exists', `${planId} exists in billing_catalog`);

      // Validate the row's tier matches the planId (credit bundles use 'pro' tier)
      const [model, suffix] = planId.split(':');
      const expectedTier = model === 'credits' ? 'pro' : suffix;
      if (row.tier !== expectedTier) {
        fail('db-tier-mismatch', `${planId}: tier="${row.tier}" but expected "${expectedTier}"`);
      }

      // Validate active flag
      if (!row.active) {
        warn('db-inactive', `${planId} is marked inactive`);
      }

      // Validate Stripe IDs are present
      if (row.stripePriceId) {
        if (row.stripePriceId.startsWith('price_')) {
          pass('db-price-id', `${planId}: stripePriceId looks valid`);
        } else {
          warn(
            'db-price-id',
            `${planId}: stripePriceId="${row.stripePriceId}" — expected "price_" prefix`,
          );
        }
      } else {
        warn('db-price-id', `${planId}: stripePriceId is null`);
      }

      if (row.stripeProductId) {
        if (row.stripeProductId.startsWith('prod_')) {
          pass('db-product-id', `${planId}: stripeProductId looks valid`);
        } else {
          warn(
            'db-product-id',
            `${planId}: stripeProductId="${row.stripeProductId}" — expected "prod_" prefix`,
          );
        }
      } else {
        // Product ID is optional (only populated from local cache)
        logger.info(`  ${planId}: stripeProductId is null (OK — populated from local cache only)`);
      }
    } else {
      fail(
        'db-plan-exists',
        `${planId} missing from billing_catalog — run pnpm billing:catalog:sync`,
      );
    }
  }

  // 3c. Check for orphaned rows (planIds not in the expected list)
  for (const row of rows) {
    if (!EXPECTED_PLAN_IDS.includes(row.planId)) {
      warn('db-orphan', `Unexpected planId="${row.planId}" in billing_catalog — may be stale`);
    }
  }

  // 3d. Check for duplicate planIds
  const planIdCounts = new Map<string, number>();
  for (const row of rows) {
    planIdCounts.set(row.planId, (planIdCounts.get(row.planId) ?? 0) + 1);
  }
  for (const [planId, count] of planIdCounts) {
    if (count > 1) {
      fail('db-duplicate', `planId="${planId}" has ${count} rows — should be unique`);
    }
  }

  // 3e. Cross-reference DB price IDs with env var price IDs
  for (const row of rows) {
    const envVarNames = EXPECTED_PRICE_ENV_VARS[row.planId];
    if (!(envVarNames && row.stripePriceId)) continue;

    const envValue = envVarNames.map((name) => process.env[name]).find(Boolean);
    if (envValue && envValue !== row.stripePriceId) {
      fail(
        'db-env-mismatch',
        `${row.planId}: DB has stripePriceId="${row.stripePriceId}" but env has "${envValue}" — re-sync with pnpm billing:catalog:sync`,
      );
    }
  }

  // 3f. Verify active entitlements reference valid tiers
  const { accountEntitlements } = await import('@revealui/db/schema');
  const tierRows = await db
    .select({ tier: accountEntitlements.tier })
    .from(accountEntitlements)
    .where(eq(accountEntitlements.status, 'active'));

  const validTiers = new Set<string>(['free', 'pro', 'max', 'enterprise']);
  for (const row of tierRows) {
    if (row.tier && !validTiers.has(row.tier)) {
      fail('db-invalid-tier', `Active entitlement with unknown tier="${row.tier}"`);
    }
  }

  if (tierRows.length > 0) {
    pass('db-entitlements', `${tierRows.length} active entitlements, all with valid tiers`);
  } else {
    logger.info('  No active entitlements found (OK for new/test environments)');
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  logger.info('Billing Catalog Validation');
  logger.info('='.repeat(50));

  validateContracts();
  validateEnvVars();

  const useDb = process.argv.includes('--db');
  if (useDb) {
    const dbUrl = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
    if (!dbUrl) {
      fail('db-connect', 'POSTGRES_URL or DATABASE_URL required for --db mode');
    } else {
      await validateDatabase();
    }
  } else {
    logger.info('--- Database validation skipped (pass --db to enable) ---');
  }

  // Summary
  logger.info('');
  logger.info('='.repeat(50));

  const passes = results.filter((r) => r.status === 'pass').length;
  const warns = results.filter((r) => r.status === 'warn').length;
  const fails = results.filter((r) => r.status === 'fail').length;

  logger.info(`Results: ${passes} pass, ${warns} warn, ${fails} fail`);

  if (fails > 0) {
    logger.error('BILLING CATALOG VALIDATION FAILED');
    logger.info('Fix the failures above before switching to live Stripe keys.');
    process.exit(1);
  }

  if (warns > 0) {
    logger.warning('BILLING CATALOG VALIDATION PASSED WITH WARNINGS');
    logger.info('Review warnings above  -  some may need attention before go-live.');
    process.exit(0);
  }

  logger.success('BILLING CATALOG VALIDATION PASSED');
}

main().catch((err) => {
  logger.error(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
