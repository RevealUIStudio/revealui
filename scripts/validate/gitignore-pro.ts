#!/usr/bin/env tsx

/**
 * Pro Package License Validation
 *
 * Verifies that every Pro (FSL-1.1-MIT) package has a valid LICENSE file
 * and matching package.json license field. Pro packages are Fair Source  -
 * source visible in the public repo, commercially licensed, converting to
 * plain MIT two years after each release.
 *
 * The Pro set is derived from packages/*\/package.json `license` field at
 * runtime (rather than hardcoded here) so this gate auto-tracks future
 * license rebalances. Precedent: until 2026-05-14 this script hardcoded
 * `[ai, harnesses]` and silently skipped engines/mcp/services after they
 * were promoted to FSL-1.1-MIT — the discovery walk closes that drift class.
 *
 * Previously this script validated gitignore entries (Issue #100).
 * After the Fair Source migration (April 2026), Pro source is public
 * and this script validates license compliance instead.
 *
 * Exit codes:
 *   0  -  all license files present and valid
 *   1  -  one or more license files missing
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '..', '..');

interface ProPackage {
  name: string;
  dir: string;
}

/**
 * Walk packages/*\/package.json and select every package whose `license`
 * field references FSL. Source of truth = the package.json files
 * themselves, so license rebalances are picked up automatically.
 */
function discoverProPackages(): ProPackage[] {
  const pkgRoot = join(REPO_ROOT, 'packages');
  const out: ProPackage[] = [];
  for (const entry of readdirSync(pkgRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const pjPath = join(pkgRoot, entry.name, 'package.json');
    if (!existsSync(pjPath)) continue;
    try {
      const pj = JSON.parse(readFileSync(pjPath, 'utf8')) as { name?: string; license?: string };
      if (typeof pj.license === 'string' && pj.license.includes('FSL')) {
        out.push({
          name: pj.name ?? `@revealui/${entry.name}`,
          dir: `packages/${entry.name}`,
        });
      }
    } catch {
      // skip unreadable / malformed package.json
    }
  }
  // Stable ordering keeps log output deterministic across runs
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

const PRO_PACKAGES: ProPackage[] = discoverProPackages();

function validateProLicenses(): boolean {
  const Sep = '='.repeat(60);
  console.log(`\n${Sep}`);
  console.log('Pro Package License Validation (Fair Source)');
  console.log(Sep);

  let allValid = true;

  for (const pkg of PRO_PACKAGES) {
    const licensePath = join(REPO_ROOT, pkg.dir, 'LICENSE');
    const pkgJsonPath = join(REPO_ROOT, pkg.dir, 'package.json');

    // Check LICENSE file exists and contains FSL
    if (!existsSync(licensePath)) {
      console.log(`  \u2717 ${pkg.name}: LICENSE file missing`);
      allValid = false;
      continue;
    }

    const licenseContent = readFileSync(licensePath, 'utf8');
    if (!licenseContent.includes('FSL-1.1-MIT')) {
      console.log(`  \u2717 ${pkg.name}: LICENSE does not contain FSL-1.1-MIT`);
      allValid = false;
      continue;
    }

    // Check package.json license field
    if (existsSync(pkgJsonPath)) {
      const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
      if (!pkgJson.license?.includes('FSL')) {
        console.log(`  \u2717 ${pkg.name}: package.json license field should reference FSL`);
        allValid = false;
        continue;
      }
    }

    console.log(`  \u2713 ${pkg.name}`);
  }

  console.log(`\n${Sep}`);

  if (allValid) {
    console.log('\u2713 Pro package license validation passed \u2014 FSL-1.1-MIT confirmed');
  } else {
    console.log('\u2717 Pro package license validation failed');
  }

  console.log(`${Sep}\n`);
  return allValid;
}

function main(): void {
  const success = validateProLicenses();
  process.exit(success ? 0 : 1);
}

main();

export { validateProLicenses };
