#!/usr/bin/env tsx

/**
 * Pro Package License Validation
 *
 * Verifies that Pro packages (ai, harnesses) have valid FSL-1.1-MIT
 * license files. Pro packages are Fair Source  -  source visible in the
 * public repo, commercially licensed, converting to MIT after 2 years.
 *
 * Previously this script validated gitignore entries (Issue #100).
 * After the Fair Source migration (April 2026), Pro source is public
 * and this script validates license compliance instead.
 *
 * Exit codes:
 *   0  -  all license files present and valid
 *   1  -  one or more license files missing
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '..', '..');

const PRO_PACKAGES = [
  { name: '@revealui/ai', dir: 'packages/ai' },
  { name: '@revealui/harnesses', dir: 'packages/harnesses' },
];

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
