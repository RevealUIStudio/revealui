#!/usr/bin/env tsx

import { readFile } from 'node:fs/promises';
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
  source: 'env' | 'local-cache';
}

const rootDir = resolve(import.meta.dirname, '../..');
const localStripeEnvCachePath = resolve(rootDir, '.revealui/stripe-env.json');
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

async function loadLocalStripeEnvCache(): Promise<Record<string, string>> {
  try {
    const raw = await readFile(localStripeEnvCachePath, 'utf8');
    const parsed = JSON.parse(raw) as { envVars?: Record<string, string> };
    return parsed.envVars ?? {};
  } catch {
    return {};
  }
}

function resolveCatalogSeeds(localCache: Record<string, string>): CatalogSeed[] {
  const resolvePriceId = (...keys: string[]) => {
    for (const key of keys) {
      const envValue = process.env[key];
      if (envValue) {
        return { stripePriceId: envValue, source: 'env' as const };
      }
      const cachedValue = localCache[key];
      if (cachedValue) {
        return { stripePriceId: cachedValue, source: 'local-cache' as const };
      }
    }
    return { stripePriceId: undefined, source: 'env' as const };
  };

  return [
    {
      planId: 'subscription:pro',
      tier: 'pro',
      billingModel: 'subscription',
      ...resolvePriceId('STRIPE_PRO_PRICE_ID', 'NEXT_PUBLIC_STRIPE_PRO_PRICE_ID'),
    },
    {
      planId: 'subscription:max',
      tier: 'max',
      billingModel: 'subscription',
      ...resolvePriceId('STRIPE_MAX_PRICE_ID', 'NEXT_PUBLIC_STRIPE_MAX_PRICE_ID'),
    },
    {
      planId: 'subscription:enterprise',
      tier: 'enterprise',
      billingModel: 'subscription',
      ...resolvePriceId('STRIPE_ENTERPRISE_PRICE_ID', 'NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID'),
    },
    {
      planId: 'perpetual:pro',
      tier: 'pro',
      billingModel: 'perpetual',
      ...resolvePriceId(
        'STRIPE_PERPETUAL_PRO_PRICE_ID',
        'NEXT_PUBLIC_STRIPE_PRO_PERPETUAL_PRICE_ID',
      ),
    },
    {
      planId: 'perpetual:max',
      tier: 'max',
      billingModel: 'perpetual',
      ...resolvePriceId(
        'STRIPE_PERPETUAL_MAX_PRICE_ID',
        'NEXT_PUBLIC_STRIPE_MAX_PERPETUAL_PRICE_ID',
      ),
    },
    {
      planId: 'perpetual:enterprise',
      tier: 'enterprise',
      billingModel: 'perpetual',
      ...resolvePriceId(
        'STRIPE_PERPETUAL_ENTERPRISE_PRICE_ID',
        'NEXT_PUBLIC_STRIPE_ENTERPRISE_PERPETUAL_PRICE_ID',
      ),
    },
  ];
}

async function main() {
  const db = getClient();
  const now = new Date();
  const localCache = await loadLocalStripeEnvCache();
  const catalogSeeds = resolveCatalogSeeds(localCache);

  let synced = 0;
  let skipped = 0;
  const sources = { env: 0, 'local-cache': 0 };

  for (const seed of catalogSeeds) {
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
        seededFrom: seed.source,
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
    sources[seed.source]++;
  }

  console.log(
    JSON.stringify(
      {
        synced,
        skipped,
        sources,
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
