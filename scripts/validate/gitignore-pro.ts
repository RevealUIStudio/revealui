#!/usr/bin/env tsx

/**
 * Gitignore Pro Package Validation
 *
 * Verifies that all Pro package paths have entries in .gitignore.
 * Pro packages (ai, harnesses) are distributed via npm and must not
 * have their source committed to the public repo. An agent accidentally
 * removed these entries once (restored in e3c910ca); this script
 * prevents that from happening again.
 *
 * Checks:
 *   1. Every required Pro path has a matching entry in .gitignore
 *   2. Both with and without trailing slash variants are present
 *   3. ee/ (enterprise edition) variants are also covered
 *
 * Exit codes:
 *   0 — all required entries present
 *   1 — one or more entries missing
 *
 * @see https://github.com/RevealUIStudio/revealui/issues/100
 *
 * @dependencies
 * - node:fs - File system operations (readFileSync)
 * - node:path - Path manipulation (join)
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// =============================================================================
// Constants
// =============================================================================

const REPO_ROOT = join(import.meta.dirname, '..', '..');
const GITIGNORE_PATH = join(REPO_ROOT, '.gitignore');

/**
 * Pro package paths that MUST be in .gitignore.
 *
 * Each entry needs both bare and trailing-slash variants so that
 * `git check-ignore` matches both `packages/ai` and `packages/ai/`.
 */
const REQUIRED_PRO_ENTRIES: string[] = [
  // Primary Pro packages
  'packages/ai',
  'packages/ai/',
  'packages/harnesses',
  'packages/harnesses/',

  // Enterprise edition variants
  'ee/packages/ai',
  'ee/packages/ai/',
  'ee/packages/harnesses',
  'ee/packages/harnesses/',
];

/**
 * Additional ee/ paths that should be gitignored for completeness.
 * These are OSS packages that were moved to public repo but still
 * have ee/ directory entries to prevent stale clones from leaking.
 */
const REQUIRED_EE_ENTRIES: string[] = [
  'ee/packages/mcp',
  'ee/packages/mcp/',
  'ee/packages/editors',
  'ee/packages/editors/',
  'ee/packages/services',
  'ee/packages/services/',
];

// =============================================================================
// Validation
// =============================================================================

function parseGitignoreEntries(content: string): Set<string> {
  const entries = new Set<string>();

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    // Skip empty lines and comments
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    entries.add(trimmed);
  }

  return entries;
}

function validateGitignoreProEntries(): boolean {
  const Sep = '='.repeat(60);
  console.log(`\n${Sep}`);
  console.log('Gitignore Pro Package Validation (Issue #100)');
  console.log(Sep);

  let content: string;
  try {
    content = readFileSync(GITIGNORE_PATH, 'utf8');
  } catch (error) {
    console.log(
      `\n  ✗ Could not read .gitignore: ${error instanceof Error ? error.message : String(error)}`,
    );
    console.log(Sep);
    return false;
  }

  const gitignoreEntries = parseGitignoreEntries(content);
  const allRequired = [...REQUIRED_PRO_ENTRIES, ...REQUIRED_EE_ENTRIES];
  const missing: string[] = [];

  console.log('\n-> Checking Pro package entries in .gitignore');

  for (const required of allRequired) {
    if (gitignoreEntries.has(required)) {
      console.log(`  ✓ ${required}`);
    } else {
      console.log(`  ✗ MISSING: ${required}`);
      missing.push(required);
    }
  }

  console.log(`\n${Sep}`);

  if (missing.length > 0) {
    console.log(`✗ Gitignore validation: ${missing.length} required Pro entry/entries missing`);
    console.log('');
    console.log('  The following entries must be added to .gitignore:');
    for (const entry of missing) {
      console.log(`    ${entry}`);
    }
    console.log('');
    console.log('  Pro package source must never be committed to the public repo.');
    console.log('  See: https://github.com/RevealUIStudio/revealui/issues/100');
    console.log(Sep);
    return false;
  }

  console.log('✓ Gitignore validation passed — all Pro package entries present');
  console.log(`${Sep}\n`);
  return true;
}

// =============================================================================
// Entry Point
// =============================================================================

function main(): void {
  const success = validateGitignoreProEntries();
  process.exit(success ? 0 : 1);
}

main();

export {
  parseGitignoreEntries,
  REQUIRED_EE_ENTRIES,
  REQUIRED_PRO_ENTRIES,
  validateGitignoreProEntries,
};
