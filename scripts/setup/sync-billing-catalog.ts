#!/usr/bin/env tsx

import { resolve } from 'node:path';
import { getClient } from '@revealui/db';
import { billingCatalog } from '@revealui/db/schema';
import { config } from 'dotenv';

type CatalogKind = 'subscription' | 'perpetual';
type PaidTier = 'pro' | 'max' | 'enterprise';

interface CatalogSeed {
  planId: string;
  tier: PaidTier;
  billingModel: CatalogKind;
  stripePriceId: string | undefined;
}

const rootDir = resolve(import.meta.dirname, '../..');
for (const envFile of [
  '.env',
  '.env.development.local',
  '.env.local',
  'apps/cms/.env.local',
  'apps/marketing/.env.local',
  'apps/api/.env.vercel',
]) {
  config({ path: resolve(rootDir, envFile), override: false });
}

const CATALOG_SEEDS: CatalogSeed[] = [
  {
    planId: 'subscription:pro',
    tier: 'pro',
    billingModel: 'subscription',
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID ?? process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID,
  },
  {
    planId: 'subscription:max',
    tier: 'max',
    billingModel: 'subscription',
    stripePriceId: process.env.STRIPE_MAX_PRICE_ID ?? process.env.NEXT_PUBLIC_STRIPE_MAX_PRICE_ID,
  },
  {
    planId: 'subscription:enterprise',
    tier: 'enterprise',
    billingModel: 'subscription',
    stripePriceId:
      process.env.STRIPE_ENTERPRISE_PRICE_ID ?? process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID,
  },
  {
    planId: 'perpetual:pro',
    tier: 'pro',
    billingModel: 'perpetual',
    stripePriceId:
      process.env.STRIPE_PERPETUAL_PRO_PRICE_ID ??
      process.env.NEXT_PUBLIC_STRIPE_PRO_PERPETUAL_PRICE_ID,
  },
  {
    planId: 'perpetual:max',
    tier: 'max',
    billingModel: 'perpetual',
    stripePriceId:
      process.env.STRIPE_PERPETUAL_MAX_PRICE_ID ??
      process.env.NEXT_PUBLIC_STRIPE_MAX_PERPETUAL_PRICE_ID,
  },
  {
    planId: 'perpetual:enterprise',
    tier: 'enterprise',
    billingModel: 'perpetual',
    stripePriceId:
      process.env.STRIPE_PERPETUAL_ENTERPRISE_PRICE_ID ??
      process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PERPETUAL_PRICE_ID,
  },
];

async function main() {
  const db = getClient();
  const now = new Date();

  let synced = 0;
  let skipped = 0;

  for (const seed of CATALOG_SEEDS) {
    if (!seed.stripePriceId) {
      skipped++;
      continue;
    }

    const values = {
      planId: seed.planId,
      tier: seed.tier,
      billingModel: seed.billingModel,
      stripePriceId: seed.stripePriceId,
      active: true,
      metadata: {
        seededFrom: 'env',
        syncedAt: now.toISOString(),
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

    synced++;
  }

  console.log(
    JSON.stringify(
      {
        synced,
        skipped,
        source: 'env',
      },
      null,
      2,
    ),
  );
}

try {
  await main();
} catch (error) {
  const pgCode = (error as { cause?: { code?: string } })?.cause?.code;

  if (pgCode === '42P01') {
    console.error(
      JSON.stringify(
        {
          error: 'billing_catalog table is missing',
          nextStep:
            'Run the account-entitlements database migration first, then rerun pnpm billing:catalog:sync.',
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  throw error;
}
