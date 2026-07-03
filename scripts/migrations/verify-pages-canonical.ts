#!/usr/bin/env tsx

/**
 * Pages-model unification — data-migration verification (F1, PR 3/3).
 *
 * The dry-run inspection against production (2026-07-03) found the `pages`
 * table already exactly canonical (site-scoped columns, zero rows, zero
 * legacy tables), so there is NO row transformation to run and the paired
 * "down" is a documented no-op. What the internal audit's risk line still
 * requires is the row-count assertion harness: this script asserts the
 * canonical invariants so any future divergence fails loudly before/after a
 * deploy instead of silently corrupting the CMS write path.
 *
 * Asserts (exit 1 on any violation, with counts):
 *   1. every live row has a non-empty site_id referencing an existing site;
 *   2. every live row has a non-empty slug and a path ('/'-prefixed);
 *   3. status is within the canonical enum (DDL CHECK backs this — asserted
 *      anyway so a future CHECK-drop cannot pass silently);
 *   4. blocks is a jsonb array (never an object / scalar);
 *   5. block_count matches jsonb_array_length(blocks) on live rows.
 *
 * Read-only. Safe against production; intended to run against a Neon branch
 * first, then production, before and after each F1 rollout step.
 *
 * Usage:
 *   pnpm tsx scripts/migrations/verify-pages-canonical.ts
 */

import { resolve } from 'node:path';
import { config } from 'dotenv';

const rootDir = resolve(import.meta.dirname, '../..');

for (const envFile of [
  '.env',
  '.env.development.local',
  '.env.local',
  'apps/server/.env.vercel',
  'apps/admin/.env.local',
]) {
  config({ path: resolve(rootDir, envFile), override: false });
}

const log = {
  info: (msg: string) => console.log(`  i ${msg}`),
  success: (msg: string) => console.log(`  + ${msg}`),
  error: (msg: string) => console.error(`  x ${msg}`),
};

async function main(): Promise<void> {
  const { getClient } = await import('@revealui/db/client');
  const { sql } = await import('drizzle-orm');

  const db = getClient('rest');

  // drizzle-raw: read-only invariant aggregate — count(*) FILTER + jsonb_typeof/
  // jsonb_array_length are not expressible through the query builder; no user input.
  const result = await db.execute(sql`
    select
      count(*)::int as total,
      count(*) filter (where deleted_at is null)::int as live,
      count(*) filter (
        where deleted_at is null
          and (site_id is null or site_id = '')
      )::int as missing_site,
      count(*) filter (
        where deleted_at is null
          and not exists (select 1 from sites s where s.id = pages.site_id)
      )::int as orphan_site,
      count(*) filter (
        where deleted_at is null and (slug is null or slug = '')
      )::int as missing_slug,
      count(*) filter (
        where deleted_at is null
          and (path is null or path = '' or left(path, 1) <> '/')
      )::int as bad_path,
      count(*) filter (
        where deleted_at is null
          and status not in ('draft', 'published', 'archived', 'scheduled')
      )::int as bad_status,
      count(*) filter (
        where deleted_at is null
          and (blocks is null or jsonb_typeof(blocks) <> 'array')
      )::int as non_array_blocks,
      count(*) filter (
        where deleted_at is null
          and blocks is not null
          and jsonb_typeof(blocks) = 'array'
          and coalesce(block_count, 0) <> jsonb_array_length(blocks)
      )::int as stale_block_count
    from pages
  `);

  const counts = result.rows[0] as Record<string, number>;
  log.info(`pages rows: ${counts.total} total, ${counts.live} live`);

  const violations: Array<[string, number]> = [
    ['live rows with missing site_id', counts.missing_site],
    ['live rows referencing a nonexistent site', counts.orphan_site],
    ['live rows with missing slug', counts.missing_slug],
    ['live rows with a non-canonical path', counts.bad_path],
    ['live rows with a non-canonical status', counts.bad_status],
    ['live rows whose blocks is not a jsonb array', counts.non_array_blocks],
    ['live rows with stale block_count', counts.stale_block_count],
  ];

  let failed = false;
  for (const [label, value] of violations) {
    if (value > 0) {
      failed = true;
      log.error(`${label}: ${value}`);
    }
  }

  if (failed) {
    log.error('Canonical invariants VIOLATED — do not proceed with the rollout step.');
    process.exit(1);
  }

  log.success('All canonical pages invariants hold.');
}

try {
  await main();
} catch (error) {
  log.error(`Fatal: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
