#!/usr/bin/env tsx

/**
 * Standalone cleanup script.
 * Called by `revealui db cleanup` via `pnpm --filter @revealui/db db:cleanup`.
 *
 * Environment:
 *   POSTGRES_URL or DATABASE_URL  -  target database
 *   DRY_RUN=true                  -  count rows without deleting
 *   TABLES=sessions,rateLimits    -  comma-separated subset (optional)
 */

import { type CleanupTable, cleanupStaleTokens } from '../cleanup/stale-tokens.js';
import { closeAllPools } from '../client/index.js';

const ALL_TABLES: CleanupTable[] = [
  'sessions',
  'rateLimits',
  'passwordResetTokens',
  'magicLinks',
  'scheduledPages',
];

const dryRun = process.env.DRY_RUN === 'true';
const tablesEnv = process.env.TABLES;
const tables: CleanupTable[] = tablesEnv
  ? (tablesEnv.split(',').map((t) => t.trim()) as CleanupTable[])
  : ALL_TABLES;

try {
  const result = await cleanupStaleTokens({ dryRun, tables });

  const verb = dryRun ? 'would delete' : 'deleted';
  console.log(`\nDB cleanup${dryRun ? ' (dry run)' : ''}:`);
  if (tables.includes('sessions')) console.log(`  sessions             ${verb} ${result.sessions}`);
  if (tables.includes('rateLimits'))
    console.log(`  rate_limits          ${verb} ${result.rateLimits}`);
  if (tables.includes('passwordResetTokens'))
    console.log(`  password_reset_tokens ${verb} ${result.passwordResetTokens}`);
  if (tables.includes('magicLinks'))
    console.log(`  magic_links          ${verb} ${result.magicLinks}`);
  if (tables.includes('scheduledPages'))
    console.log(`  pages (scheduled)    published ${result.scheduledPages}`);
  console.log('');

  await closeAllPools();
  process.exit(0);
} catch (error) {
  console.error('Cleanup failed:', error instanceof Error ? error.message : String(error));
  await closeAllPools().catch((_e) => {
    // best-effort  -  already in error path
  });
  process.exit(1);
}
