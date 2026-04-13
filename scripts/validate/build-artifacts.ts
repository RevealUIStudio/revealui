#!/usr/bin/env tsx

/**
 * Validate Build Artifacts
 *
 * Ensures all publishable packages have correct dist/ output after build.
 * Run locally with: pnpm validate:artifacts
 * Also used by release-canary.yml to replace inline bash validation.
 *
 * Packages that don't compile (e.g. create-revealui  -  thin bin/ wrapper)
 * are excluded from the dist/ check but validated for their bin/ entry.
 *
 * @dependencies
 * - node:fs - File system operations
 * - node:path - Path manipulation
 */

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');

/** Packages that compile to dist/ and must have .js output */
const DIST_PACKAGES = [
  'auth',
  'cache',
  'cli',
  'config',
  'contracts',
  'core',
  'db',
  'mcp',
  'openapi',
  'presentation',
  'resilience',
  'router',
  'security',
  'services',
  'setup',
  'sync',
  'utils',
];

/** Packages that ship raw (no compilation)  -  validated differently */
const BIN_ONLY_PACKAGES = [{ name: 'create-revealui', bin: 'bin/create-revealui.js' }];

interface Result {
  package: string;
  ok: boolean;
  detail: string;
}

function validateDistPackages(): Result[] {
  return DIST_PACKAGES.map((pkg) => {
    const distDir = join(ROOT, 'packages', pkg, 'dist');
    if (!existsSync(distDir)) {
      return { package: pkg, ok: false, detail: 'dist/ directory missing' };
    }

    const jsFiles = readdirSync(distDir).filter((f) => f.endsWith('.js'));
    if (jsFiles.length === 0) {
      return { package: pkg, ok: false, detail: 'dist/ has no .js files' };
    }

    return { package: pkg, ok: true, detail: `${jsFiles.length} .js files` };
  });
}

function validateBinPackages(): Result[] {
  return BIN_ONLY_PACKAGES.map(({ name, bin }) => {
    const binPath = join(ROOT, 'packages', name, bin);
    if (!existsSync(binPath)) {
      return { package: name, ok: false, detail: `${bin} missing` };
    }
    return { package: name, ok: true, detail: `${bin} exists (no-compile package)` };
  });
}

function main(): void {
  console.log('Validating build artifacts...\n');

  const results = [...validateDistPackages(), ...validateBinPackages()];
  const failures = results.filter((r) => !r.ok);

  for (const r of results) {
    const icon = r.ok ? '\u2705' : '\u274C';
    console.log(`${icon} ${r.package}: ${r.detail}`);
  }

  console.log('');

  if (failures.length > 0) {
    console.error(`Build artifact validation failed: ${failures.length} package(s) missing output`);
    console.error('Run `pnpm build` first, then re-check.');
    process.exit(1);
  }

  console.log(`All ${results.length} packages validated.`);
}

main();
