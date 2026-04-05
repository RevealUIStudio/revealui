#!/usr/bin/env tsx

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createClient } from '@revealui/db';
import { billingCatalog } from '@revealui/db/schema';
import { config } from 'dotenv';

type CatalogKind = 'subscription' | 'perpetual' | 'credits' | 'renewal';
type PaidTier = 'pro' | 'max' | 'enterprise';

interface CatalogSeed {
  planId: string;
  tier: PaidTier;
  billingModel: CatalogKind;
  stripeProductId?: string;
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

async function loadLocalStripeEnvCache(): Promise<{
  envVars: Record<string, string>;
  catalogEntries: Array<{
    planId: string;
    stripeProductId: string;
    stripePriceId: string;
  }>;
}> {
  try {
    const raw = await readFile(localStripeEnvCachePath, 'utf8');
    const parsed = JSON.parse(raw) as {
      envVars?: Record<string, string>;
      catalogEntries?: Array<{
        planId: string;
        stripeProductId: string;
        stripePriceId: string;
      }>;
    };
    return {
      envVars: parsed.envVars ?? {},
      catalogEntries: parsed.catalogEntries ?? [],
    };
  } catch {
    return {
      envVars: {},
      catalogEntries: [],
    };
  }
}

function resolveCatalogSeeds(localCache: {
  envVars: Record<string, string>;
  catalogEntries: Array<{
    planId: string;
    stripeProductId: string;
    stripePriceId: string;
  }>;
}): CatalogSeed[] {
  const resolvePriceId = (...keys: string[]) => {
    for (const key of keys) {
      const envValue = process.env[key];
      if (envValue) {
        return { stripePriceId: envValue, source: 'env' as const };
      }
      const cachedValue = localCache.envVars[key];
      if (cachedValue) {
        return { stripePriceId: cachedValue, source: 'local-cache' as const };
      }
    }
    return { stripePriceId: undefined, source: 'env' as const };
  };
  const resolveProductId = (planId: string) =>
    localCache.catalogEntries.find((entry) => entry.planId === planId)?.stripeProductId;

  return [
    {
      planId: 'subscription:pro',
      tier: 'pro',
      billingModel: 'subscription',
      stripeProductId: resolveProductId('subscription:pro'),
      ...resolvePriceId('STRIPE_PRO_PRICE_ID', 'NEXT_PUBLIC_STRIPE_PRO_PRICE_ID'),
    },
    {
      planId: 'subscription:max',
      tier: 'max',
      billingModel: 'subscription',
      stripeProductId: resolveProductId('subscription:max'),
      ...resolvePriceId('STRIPE_MAX_PRICE_ID', 'NEXT_PUBLIC_STRIPE_MAX_PRICE_ID'),
    },
    {
      planId: 'subscription:enterprise',
      tier: 'enterprise',
      billingModel: 'subscription',
      stripeProductId: resolveProductId('subscription:enterprise'),
      ...resolvePriceId('STRIPE_ENTERPRISE_PRICE_ID', 'NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID'),
    },
    {
      planId: 'perpetual:pro',
      tier: 'pro',
      billingModel: 'perpetual',
      stripeProductId: resolveProductId('perpetual:pro'),
      ...resolvePriceId(
        'STRIPE_PERPETUAL_PRO_PRICE_ID',
        'NEXT_PUBLIC_STRIPE_PRO_PERPETUAL_PRICE_ID',
      ),
    },
    {
      planId: 'perpetual:max',
      tier: 'max',
      billingModel: 'perpetual',
      stripeProductId: resolveProductId('perpetual:max'),
      ...resolvePriceId(
        'STRIPE_PERPETUAL_MAX_PRICE_ID',
        'NEXT_PUBLIC_STRIPE_MAX_PERPETUAL_PRICE_ID',
      ),
    },
    {
      planId: 'perpetual:enterprise',
      tier: 'enterprise',
      billingModel: 'perpetual',
      stripeProductId: resolveProductId('perpetual:enterprise'),
      ...resolvePriceId(
        'STRIPE_PERPETUAL_ENTERPRISE_PRICE_ID',
        'NEXT_PUBLIC_STRIPE_ENTERPRISE_PERPETUAL_PRICE_ID',
      ),
    },
    // Credit bundles (Track B)
    // Support renewal (Track C — annual renewal for perpetual licenses)
    {
      planId: 'renewal:pro',
      tier: 'pro',
      billingModel: 'renewal',
      stripeProductId: resolveProductId('renewal:pro'),
      ...resolvePriceId('STRIPE_RENEWAL_PRO_PRICE_ID'),
    },
    {
      planId: 'renewal:max',
      tier: 'max',
      billingModel: 'renewal',
      stripeProductId: resolveProductId('renewal:max'),
      ...resolvePriceId('STRIPE_RENEWAL_MAX_PRICE_ID'),
    },
    {
      planId: 'renewal:enterprise',
      tier: 'enterprise',
      billingModel: 'renewal',
      stripeProductId: resolveProductId('renewal:enterprise'),
      ...resolvePriceId('STRIPE_RENEWAL_ENTERPRISE_PRICE_ID'),
    },
    // Credit bundles (Track B)
    {
      planId: 'credits:starter',
      tier: 'pro',
      billingModel: 'credits',
      stripeProductId: resolveProductId('credits:starter'),
      ...resolvePriceId('STRIPE_CREDITS_STARTER_PRICE_ID'),
    },
    {
      planId: 'credits:standard',
      tier: 'pro',
      billingModel: 'credits',
      stripeProductId: resolveProductId('credits:standard'),
      ...resolvePriceId('STRIPE_CREDITS_STANDARD_PRICE_ID'),
    },
    {
      planId: 'credits:scale',
      tier: 'pro',
      billingModel: 'credits',
      stripeProductId: resolveProductId('credits:scale'),
      ...resolvePriceId('STRIPE_CREDITS_SCALE_PRICE_ID'),
    },
  ];
}

/**
 * Resolve the database connection string for this script.
 *
 * Priority:
 *   1. CLI argument: --database-url <url>
 *   2. NEON_DATABASE_URL env var (explicit NeonDB override for scripts)
 *   3. POSTGRES_URL / DATABASE_URL env vars
 *
 * Rejects localhost URLs since this script syncs to the remote NeonDB instance
 * and the dev environment (direnv/Nix) typically sets POSTGRES_URL to localhost.
 */
function resolveConnectionString(): string {
  // Check CLI argument
  const dbUrlFlagIndex = process.argv.indexOf('--database-url');
  if (dbUrlFlagIndex !== -1 && process.argv[dbUrlFlagIndex + 1]) {
    return process.argv[dbUrlFlagIndex + 1];
  }

  const url = process.env.NEON_DATABASE_URL || process.env.POSTGRES_URL || process.env.DATABASE_URL;

  if (!url) {
    console.error(
      JSON.stringify(
        {
          error: 'No database connection string found',
          hint: 'Provide a NeonDB URL via one of: --database-url <url>, NEON_DATABASE_URL, POSTGRES_URL, or DATABASE_URL',
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  if (url.includes('localhost') || url.includes('127.0.0.1')) {
    console.error(
      JSON.stringify(
        {
          error: 'Connection string points to localhost — no local PostgreSQL available',
          resolved: `${url.split('@')[0].split('://')[0]}://****@localhost/...`,
          hint: 'Set NEON_DATABASE_URL to your NeonDB connection string, or pass --database-url <url>',
          example:
            'NEON_DATABASE_URL="postgresql://...@....neon.tech/neondb?sslmode=require" pnpm billing:catalog:sync',
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  return url;
}

async function main() {
  const connectionString = resolveConnectionString();
  const db = createClient({ connectionString });
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
      stripeProductId: seed.stripeProductId,
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
