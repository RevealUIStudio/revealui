#!/usr/bin/env tsx

/**
 * Seed Script Wiring Validation
 *
 * Every file under scripts/setup/ whose name begins with "seed" MUST have a
 * corresponding npm script in package.json that invokes it. Otherwise the
 * script silently rots after a rename, never runs in any sweep, and the
 * fleet picks up a "ghost" workflow surface — the same drift class as the
 * unwired-validator pattern this gate's sibling rules address.
 *
 * Exit codes:
 *   0  -  every seed script has at least one npm-scripts entry that
 *         references its relative path.
 *   1  -  one or more seed scripts are unwired.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '..', '..');
const SEED_DIR_REL = 'scripts/setup';
const SEED_DIR_ABS = join(REPO_ROOT, SEED_DIR_REL);

interface SeedScript {
  fileName: string;
  relativePath: string;
}

interface PackageJson {
  scripts?: Record<string, string>;
}

function discoverSeedScripts(): SeedScript[] {
  const entries = readdirSync(SEED_DIR_ABS, { withFileTypes: true });
  const seeds: SeedScript[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.startsWith('seed')) continue;
    if (!entry.name.endsWith('.ts')) continue;
    seeds.push({
      fileName: entry.name,
      relativePath: `${SEED_DIR_REL}/${entry.name}`,
    });
  }
  return seeds.sort((a, b) => a.fileName.localeCompare(b.fileName));
}

function loadPackageScripts(): Record<string, string> {
  const pkgPath = join(REPO_ROOT, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as PackageJson;
  return pkg.scripts ?? {};
}

function findReferencingScripts(seed: SeedScript, npmScripts: Record<string, string>): string[] {
  const matches: string[] = [];
  for (const [scriptName, scriptBody] of Object.entries(npmScripts)) {
    if (scriptBody.includes(seed.relativePath)) {
      matches.push(scriptName);
    }
  }
  return matches.sort();
}

function validateSeedWiring(): boolean {
  const Sep = '='.repeat(60);
  console.log(`\n${Sep}`);
  console.log('Seed Script Wiring Validation');
  console.log(Sep);

  const seeds = discoverSeedScripts();
  if (seeds.length === 0) {
    console.log('No seed scripts found under scripts/setup/');
    console.log(`${Sep}\n`);
    return true;
  }

  const npmScripts = loadPackageScripts();
  let allWired = true;

  for (const seed of seeds) {
    const callers = findReferencingScripts(seed, npmScripts);
    if (callers.length === 0) {
      console.log(`  ✗ ${seed.relativePath}`);
      console.log(`    No npm script in package.json invokes this file.`);
      console.log(`    Add an entry like: "<name>": "tsx ${seed.relativePath}"`);
      allWired = false;
    } else {
      console.log(`  ✓ ${seed.relativePath} ← ${callers.join(', ')}`);
    }
  }

  console.log(`\n${Sep}`);
  if (allWired) {
    console.log('✓ Seed script wiring validation passed');
  } else {
    console.log('✗ Seed script wiring validation failed');
  }
  console.log(`${Sep}\n`);

  return allWired;
}

function main(): void {
  const ok = validateSeedWiring();
  process.exit(ok ? 0 : 1);
}

main();

export { validateSeedWiring };
