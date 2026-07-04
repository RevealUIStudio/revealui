#!/usr/bin/env tsx

/**
 * Seed the canonical `pages` table with the fleet-marketing home page.
 *
 * Canonical-direct shape: ALL content lives in the `blocks` jsonb column with
 * the hero as the first block; `seo` is stored directly. This matches the
 * admin Pages collection after the Pages-model unification, so the seeded row
 * is immediately editable in the dashboard and renderable at `/`.
 *
 * Idempotent: if a row with slug 'home' already exists for the
 * fleet-marketing site (soft-deleted rows included — those are surfaced, not
 * silently replaced), logs and exits 0. Fails fast if the fleet-marketing
 * site row does not exist (run scripts/seed-fleet-marketing-site.ts first) —
 * pages.site_id is a NOT NULL FK, so seeding order matters.
 *
 * Usage:
 *   pnpm tsx scripts/seed-fleet-marketing-home-page.ts
 *   pnpm tsx scripts/seed-fleet-marketing-home-page.ts -- --dry-run
 */

import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config } from 'dotenv';

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
const HOME_SLUG = 'home';

const log = {
  info: (msg: string) => console.log(`  i ${msg}`),
  success: (msg: string) => console.log(`  + ${msg}`),
  warn: (msg: string) => console.log(`  ! ${msg}`),
  error: (msg: string) => console.error(`  x ${msg}`),
};

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  if (dryRun) {
    log.warn('DRY RUN — no writes will be made');
  }

  const { getClient } = await import('@revealui/db/client');
  const { pages, sites } = await import('@revealui/db/schema');
  const { and, eq } = await import('drizzle-orm');

  const db = getClient('rest');

  const siteRows = await db
    .select({ id: sites.id })
    .from(sites)
    .where(eq(sites.id, SITE_ID))
    .limit(1);

  if (siteRows.length === 0) {
    log.error(`Site row not found: ${SITE_ID}`);
    log.error('Run pnpm tsx scripts/seed-fleet-marketing-site.ts first, then re-run this script.');
    process.exit(1);
  }

  const existing = await db
    .select({
      id: pages.id,
      path: pages.path,
      status: pages.status,
      deletedAt: pages.deletedAt,
    })
    .from(pages)
    .where(and(eq(pages.siteId, SITE_ID), eq(pages.slug, HOME_SLUG)))
    .limit(1);

  if (existing.length > 0) {
    const row = existing[0];
    if (row.deletedAt) {
      log.warn(`Home page exists but is soft-deleted (id ${row.id}, deleted ${row.deletedAt}).`);
      log.warn('Not resurrecting automatically — restore or hard-delete it deliberately.');
      process.exit(1);
    }
    log.info('Already seeded, skipping.');
    log.info(`  id:     ${row.id}`);
    log.info(`  path:   ${row.path}`);
    log.info(`  status: ${row.status}`);
    return;
  }

  const now = new Date();
  // Canonical-direct blocks: hero first, then a content block. Shapes match
  // the admin Pages collection blocks (Hero/Content block configs).
  const blocks = [
    {
      id: randomUUID(),
      blockType: 'hero',
      type: 'lowImpact',
      richText: {
        root: {
          type: 'root',
          version: 1,
          direction: 'ltr',
          format: '',
          indent: 0,
          children: [
            {
              type: 'heading',
              tag: 'h1',
              version: 1,
              children: [{ type: 'text', version: 1, text: 'RevealUI' }],
            },
            {
              type: 'paragraph',
              version: 1,
              children: [
                {
                  type: 'text',
                  version: 1,
                  text: 'People, content, offers, payments, and agents — pre-wired.',
                },
              ],
            },
          ],
        },
      },
    },
  ];

  const row = {
    id: `rvl_${randomUUID()}`,
    siteId: SITE_ID,
    title: 'Home',
    slug: HOME_SLUG,
    path: '/',
    status: 'published',
    blocks,
    blockCount: blocks.length,
    seo: {
      title: 'RevealUI',
      description: 'Agentic business runtime — people, content, offers, payments, and agents.',
    },
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  if (dryRun) {
    log.info('Would insert:');
    log.info(JSON.stringify(row, null, 2));
    log.success('Dry run complete — no writes made.');
    return;
  }

  await db.insert(pages).values(row).onConflictDoNothing();

  const inserted = await db
    .select({ id: pages.id, path: pages.path, status: pages.status })
    .from(pages)
    .where(and(eq(pages.siteId, SITE_ID), eq(pages.slug, HOME_SLUG)))
    .limit(1);

  if (inserted.length === 0) {
    log.error('Insert reported no conflict but row is not present — unexpected state.');
    process.exit(1);
  }

  const seeded = inserted[0];
  log.success('Seeded fleet-marketing home page.');
  log.info(`  id:     ${seeded.id}`);
  log.info(`  path:   ${seeded.path}`);
  log.info(`  status: ${seeded.status}`);
}

try {
  await main();
} catch (error) {
  log.error(`Fatal: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
