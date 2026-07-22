#!/usr/bin/env tsx

/**
 * Local dogfood API launcher (server on :3004).
 *
 * Why this exists (2026-07-22 dogfood):
 *   - `pnpm --filter server dev` alone fails closed without POSTGRES_URL /
 *     NODE_ENV / hosted license private key (audit + license startup gates).
 *   - bare `loadSeedEnv` is enough for DB; license keys live in revvault.
 *   - Admin canvas calls `NEXT_PUBLIC_API_URL` (default prod). For local VES
 *     set `NEXT_PUBLIC_API_URL=http://localhost:3004` in apps/admin/.env.local
 *     and restart admin.
 *   - Voice gate on fleet-marketing needs a current `@revealui/contracts` dist
 *     (section / ctaSection prose slots). Pass `--build-contracts` if voice
 *     rejects unmapped blockTypes after a pull.
 *
 * Usage:
 *   pnpm dogfood:api
 *   pnpm dogfood:api -- --build-contracts
 *
 * Does not start admin or marketing. Pair with:
 *   pnpm --filter marketing dev   # :3000
 *   pnpm dev:admin                # :4000 (after NEXT_PUBLIC_API_URL)
 */

import { spawn, execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertSeedDatabaseReady,
  loadSeedEnv,
  resolveSeedDatabaseUrl,
  SeedEnvError,
} from '../lib/seed-env.js';

const rootDir = process.cwd();

function revvaultGet(path: string): string | null {
  try {
    return execFileSync('revvault', ['get', '--full', path], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return null;
  }
}

function contractsDistHasSectionSlots(): boolean {
  try {
    const dist = readFileSync(
      resolve(rootDir, 'packages/contracts/dist/marketing-voice/blocks.js'),
      'utf8',
    );
    return dist.includes('section:') && dist.includes('ctaSection:');
  } catch {
    return false;
  }
}

function buildContracts(): void {
  console.log('  i Building @revealui/contracts (voice prose slots)…');
  execFileSync('pnpm', ['--filter', '@revealui/contracts', 'build'], {
    cwd: rootDir,
    stdio: 'inherit',
  });
}

async function main(): Promise<void> {
  const buildContractsFlag = process.argv.includes('--build-contracts');

  console.log('\n' + '='.repeat(60));
  console.log('  Dogfood API (local server :3004)');
  console.log('='.repeat(60) + '\n');

  loadSeedEnv(rootDir);
  const url = resolveSeedDatabaseUrl();
  if (!url) {
    throw new SeedEnvError(
      'No database URL. Point apps/admin/.env.local POSTGRES_URL at docker postgres ' +
        '(default :5432/revealui), then re-run.',
    );
  }

  await assertSeedDatabaseReady();
  console.log('  + Database reachable (seed-env preflight)');

  if (buildContractsFlag || !contractsDistHasSectionSlots()) {
    if (!buildContractsFlag) {
      console.log(
        '  ! contracts dist missing section/ctaSection slots — rebuilding (stale dist breaks VES voice gate)',
      );
    }
    buildContracts();
  } else {
    console.log('  + contracts dist has section/ctaSection voice slots');
  }

  const privateKey =
    revvaultGet('revealui/staging/license/private-key') ||
    revvaultGet('revdev/license-signing-private-key');
  if (!privateKey) {
    throw new SeedEnvError(
      'No REVEALUI_LICENSE_PRIVATE_KEY in revvault ' +
        '(tried revealui/staging/license/private-key, revdev/license-signing-private-key). ' +
        'Hosted local mode needs a private key so startup does not require forge LICENSE_KEY.',
    );
  }
  console.log('  + License private key (hosted mode)');

  // Match packages/config default when unset so admin session cookies validate CSRF.
  const secret =
    process.env.REVEALUI_SECRET ||
    'INSECURE-DEV-ONLY-CHANGE-ME-SET-REVEALUI_SECRET-IN-PRODUCTION';

  if (!process.env.NEXT_PUBLIC_API_URL) {
    console.log(
      '  ! Reminder: set NEXT_PUBLIC_API_URL=http://localhost:3004 in apps/admin/.env.local and restart admin for canvas',
    );
  }

  console.log('  i Starting pnpm --filter server dev …\n');

  const child = spawn('pnpm', ['--filter', 'server', 'dev'], {
    cwd: rootDir,
    env: {
      ...process.env,
      NODE_ENV: process.env.NODE_ENV || 'development',
      POSTGRES_URL: url,
      DATABASE_URL: url,
      REVEALUI_LICENSE_PRIVATE_KEY: privateKey,
      REVEALUI_SECRET: secret,
      SESSION_SECRET: process.env.SESSION_SECRET || secret,
    },
    stdio: 'inherit',
  });

  child.on('exit', (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    process.exit(code ?? 1);
  });
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`  x ${msg}`);
  process.exit(1);
});
