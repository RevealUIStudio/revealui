#!/usr/bin/env tsx

/**
 * Seed the fleet-marketing `sites` row plus its `home` and `products` pages
 * (Phase A.2 + the visual-edit-sessions block wire).
 *
 * The page `blocks` come from the SAME pure derivation the marketing app falls
 * back to (`apps/marketing/app/lib/page-blocks.ts`), so the seeded CMS content
 * and the site's static fallback can never drift: both are derived from the
 * claim-covered content modules.
 *
 * Idempotent: the site row is inserted once; each page is inserted if missing,
 * updated (with an optimistic version guard) only when its blocks changed, and
 * skipped when its blocks already match. Soft-deleted pages are surfaced, never
 * silently resurrected. Fails fast if the founder user or the site row is
 * missing (bootstrap + site seed must run first).
 *
 * Usage:
 *   pnpm tsx scripts/seed-fleet-marketing-site.ts
 *   pnpm tsx scripts/seed-fleet-marketing-site.ts -- --dry-run
 *
 * Spec: the internal visual-edit-sessions spec (2026-07-02); Phase A.2 row A2.
 */

import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { homeBlocks, productsBlocks } from '../apps/marketing/app/lib/page-blocks';

const rootDir = resolve(import.meta.dirname, '..');

for (const envFile of [
  '.env',
  '.env.development.local',
  '.env.local',
  'apps/server/.env.vercel',
  'apps/admin/.env.local',
]) {
  config({ path: resolve(rootDir, envFile), override: false });
}

const SITE_ID = 'fleet-marketing';
const FOUNDER_EMAIL = 'founder@revealui.com';

const log = {
  info: (msg: string) => console.log(`  i ${msg}`),
  success: (msg: string) => console.log(`  + ${msg}`),
  warn: (msg: string) => console.log(`  ! ${msg}`),
  error: (msg: string) => console.error(`  x ${msg}`),
};

interface PageSeed {
  readonly slug: string;
  readonly path: string;
  readonly title: string;
  readonly blocks: unknown[];
  readonly seo: { title: string; description: string };
}

const PAGE_SEEDS: readonly PageSeed[] = [
  {
    slug: 'home',
    path: '/',
    title: 'Home',
    blocks: homeBlocks(),
    seo: {
      title: 'RevealUI',
      description: 'Agentic business runtime. People, content, offers, payments, and agents.',
    },
  },
  {
    slug: 'products',
    path: '/products',
    title: 'Products',
    blocks: productsBlocks(),
    seo: {
      title: 'The RevFleet product family',
      description: 'Seven products on one foundation, all built and operated by RevealUI Studio.',
    },
  },
];

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  if (dryRun) {
    log.warn('DRY RUN — no writes will be made');
  }

  const { getClient } = await import('@revealui/db/client');
  const { users, sites, pages } = await import('@revealui/db/schema');
  const { and, eq } = await import('drizzle-orm');

  const db = getClient('rest');

  // ---------------------------------------------------------------------------
  // Site row
  // ---------------------------------------------------------------------------

  const founderRows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, FOUNDER_EMAIL))
    .limit(1);

  if (founderRows.length === 0) {
    log.error(`Founder user not found: ${FOUNDER_EMAIL}`);
    log.error('Run pnpm admin:bootstrap (or pnpm db:seed:admin) first, then re-run this script.');
    process.exit(1);
  }

  const ownerId = founderRows[0].id;
  log.info(`Resolved ownerId for ${FOUNDER_EMAIL}: ${ownerId}`);

  const existingSite = await db
    .select({ id: sites.id, slug: sites.slug, status: sites.status })
    .from(sites)
    .where(eq(sites.id, SITE_ID))
    .limit(1);

  const now = new Date();

  if (existingSite.length > 0) {
    const row = existingSite[0];
    log.info('Site already seeded, skipping.');
    log.info(`  id:     ${row.id}`);
    log.info(`  slug:   ${row.slug}`);
    log.info(`  status: ${row.status}`);
  } else {
    const siteRow = {
      id: SITE_ID,
      ownerId,
      name: 'RevealUI fleet marketing',
      slug: 'fleet-marketing',
      description: 'revealui.com customer-facing copy',
      status: 'published' as const,
      theme: { brand: 'revealui-fleet' },
      settings: {
        cacheStrategy: 'edge-tag',
        voiceProfile: 'fleet',
        aiGeneration: {
          provider: 'inference-snaps',
          model: 'gemma3',
          embedModel: 'gemma3',
        },
      },
      publishedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    if (dryRun) {
      log.info('Would insert site:');
      log.info(JSON.stringify(siteRow, null, 2));
    } else {
      await db.insert(sites).values(siteRow).onConflictDoNothing({ target: sites.id });
      const inserted = await db
        .select({ id: sites.id })
        .from(sites)
        .where(eq(sites.id, SITE_ID))
        .limit(1);
      if (inserted.length === 0) {
        log.error('Site insert reported no conflict but row is not present — unexpected state.');
        process.exit(1);
      }
      log.success('Seeded fleet-marketing site row.');
    }
  }

  // ---------------------------------------------------------------------------
  // Pages (home + products) — version-safe, idempotent
  // ---------------------------------------------------------------------------

  for (const seed of PAGE_SEEDS) {
    const existing = await db
      .select({
        id: pages.id,
        version: pages.version,
        blocks: pages.blocks,
        status: pages.status,
        deletedAt: pages.deletedAt,
      })
      .from(pages)
      .where(and(eq(pages.siteId, SITE_ID), eq(pages.slug, seed.slug)))
      .limit(1);

    if (existing.length > 0) {
      const row = existing[0];
      if (row.deletedAt) {
        log.warn(`Page "${seed.slug}" exists but is soft-deleted (id ${row.id}).`);
        log.warn('Not resurrecting automatically — restore or hard-delete it deliberately.');
        continue;
      }

      const currentJson = JSON.stringify(row.blocks ?? []);
      const desiredJson = JSON.stringify(seed.blocks);
      if (currentJson === desiredJson) {
        log.info(`Page "${seed.slug}" already up to date (v${row.version}), skipping.`);
        continue;
      }

      if (dryRun) {
        log.info(
          `Would update page "${seed.slug}" blocks (v${row.version} -> v${row.version + 1}).`,
        );
        continue;
      }

      // Optimistic version guard: only write if the row hasn't changed since read.
      const updated = await db
        .update(pages)
        .set({
          blocks: seed.blocks,
          blockCount: seed.blocks.length,
          version: row.version + 1,
          updatedAt: new Date(),
        })
        .where(and(eq(pages.id, row.id), eq(pages.version, row.version)))
        .returning({ id: pages.id });

      if (updated.length === 0) {
        log.error(`Page "${seed.slug}" changed concurrently (version moved past ${row.version}).`);
        log.error('Re-run the seed to reconcile.');
        process.exit(1);
      }
      log.success(`Updated page "${seed.slug}" blocks -> v${row.version + 1}.`);
      continue;
    }

    const pageRow = {
      id: `rvl_${randomUUID()}`,
      siteId: SITE_ID,
      title: seed.title,
      slug: seed.slug,
      path: seed.path,
      status: 'published',
      blocks: seed.blocks,
      blockCount: seed.blocks.length,
      seo: seed.seo,
      publishedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    if (dryRun) {
      log.info(`Would insert page "${seed.slug}":`);
      log.info(JSON.stringify(pageRow, null, 2));
      continue;
    }

    await db.insert(pages).values(pageRow).onConflictDoNothing();
    const inserted = await db
      .select({ id: pages.id, status: pages.status })
      .from(pages)
      .where(and(eq(pages.siteId, SITE_ID), eq(pages.slug, seed.slug)))
      .limit(1);
    if (inserted.length === 0) {
      log.error(`Page "${seed.slug}" insert reported no conflict but row is not present.`);
      process.exit(1);
    }
    log.success(`Seeded page "${seed.slug}" (${inserted[0].status}).`);
  }

  if (dryRun) {
    log.success('Dry run complete — no writes made.');
  }
}

try {
  await main();
} catch (error) {
  log.error(`Fatal: ${error instanceof Error ? error.message : String(error)}`);
  if (error instanceof Error && error.stack) {
    log.error(error.stack);
  }
  process.exit(1);
}
