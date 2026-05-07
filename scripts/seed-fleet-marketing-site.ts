#!/usr/bin/env tsx

/**
 * Seed the `sites` table with the fleet-marketing row (Phase A.2).
 *
 * Idempotent: if a row with id='fleet-marketing' already exists, logs and exits 0.
 * Resolves ownerId by looking up founder@revealui.com in the users table — fails fast
 * if that user does not exist yet (bootstrap must run first).
 *
 * Usage:
 *   pnpm tsx scripts/seed-fleet-marketing-site.ts
 *   pnpm tsx scripts/seed-fleet-marketing-site.ts -- --dry-run
 *
 * Spec: .jv/docs/spec-2026-05-08-marketing-content-cms.md §2.1 + §9 row A2
 */

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
const FOUNDER_EMAIL = 'founder@revealui.com';

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
  const { users, sites } = await import('@revealui/db/schema');
  const { eq } = await import('drizzle-orm');

  const db = getClient('rest');

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

  const existing = await db
    .select({ id: sites.id, slug: sites.slug, status: sites.status })
    .from(sites)
    .where(eq(sites.id, SITE_ID))
    .limit(1);

  if (existing.length > 0) {
    const row = existing[0];
    log.info('Already seeded, skipping.');
    log.info(`  id:     ${row.id}`);
    log.info(`  slug:   ${row.slug}`);
    log.info(`  status: ${row.status}`);
    return;
  }

  const now = new Date();

  const row = {
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
    log.info('Would insert:');
    log.info(JSON.stringify(row, null, 2));
    log.success('Dry run complete — no writes made.');
    return;
  }

  await db.insert(sites).values(row).onConflictDoNothing({ target: sites.id });

  const inserted = await db
    .select({ id: sites.id, slug: sites.slug, status: sites.status })
    .from(sites)
    .where(eq(sites.id, SITE_ID))
    .limit(1);

  if (inserted.length === 0) {
    log.error('Insert reported no conflict but row is not present — unexpected state.');
    process.exit(1);
  }

  const seeded = inserted[0];
  log.success('Seeded fleet-marketing site row.');
  log.info(`  id:     ${seeded.id}`);
  log.info(`  slug:   ${seeded.slug}`);
  log.info(`  status: ${seeded.status}`);
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
