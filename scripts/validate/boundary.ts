#!/usr/bin/env tsx

/**
 * Internal/Productized Boundary Validator
 *
 * Phase 2.11 enforcement — run as part of pnpm gate phase 1 (hard fail).
 *
 * Five checks:
 *   1. OSS packages do not import commercial Pro packages
 *   2. Published package source files contain no internal dev references
 *   3. Published package `files` fields do not include internal-only directories
 *   4. Public repo source/config files contain no direct Pro source-tree aliases
 *   5. Public repo source/manifests do not hard-require optional Pro packages
 *
 * Commercial packages (LICENSE.commercial): ai, mcp, editors, services, harnesses
 * OSS packages (MIT): core, cli, presentation, contracts, db, auth, config,
 *                     router, setup, sync, dev, test, utils
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// =============================================================================
// Constants
// =============================================================================

const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');

const PACKAGES_DIR = join(REPO_ROOT, 'packages');
const APPS_DIR = join(REPO_ROOT, 'apps');
const SCRIPTS_DIR = join(REPO_ROOT, 'scripts');

// Packages distributed under LICENSE.commercial (must not leak into OSS source)
const COMMERCIAL_PACKAGES = [
  '@revealui/ai',
  '@revealui/mcp',
  '@revealui/editors',
  '@revealui/services',
  '@revealui/harnesses',
];

// OSS package directory names (packages that must not import commercial ones)
const OSS_PACKAGE_NAMES = [
  'auth',
  'cli',
  'config',
  'contracts',
  'core',
  'db',
  'dev',
  'presentation',
  'router',
  'setup',
  'sync',
  'test',
  'utils',
];

// Patterns that must not appear in published package source.
// Uses string-based checks instead of regex where possible.
interface SourcePattern {
  check: (content: string) => boolean;
  reason: string;
}

const INTERNAL_SOURCE_PATTERNS: SourcePattern[] = [
  {
    check: (content) => content.includes('/home/') && content.includes('/projects/'),
    reason: 'absolute Linux home path (machine-specific)',
  },
  {
    check: (content) => content.includes('C:\\Users\\'),
    reason: 'absolute Windows user path (machine-specific)',
  },
  {
    check: (content) => content.includes('/mnt/wsl-dev/'),
    reason: 'DevPod mount path (machine-specific)',
  },
  {
    check: (content) => content.includes('MASTER_PLAN.md'),
    reason: 'MASTER_PLAN.md reference (internal planning doc)',
  },
  {
    check: (content) => content.includes('business/'),
    reason: 'business/ directory reference (internal)',
  },
  {
    check: (content) => content.includes('founder@revealui.com'),
    reason: 'founder email address (internal identity)',
  },
  {
    check: (content) => {
      // Check for RevealUIStudio/ not preceded by github.com/ or githubusercontent.com/
      const needle = 'RevealUIStudio/';
      let idx = content.indexOf(needle);
      while (idx !== -1) {
        const prefix = content.substring(Math.max(0, idx - 30), idx);
        if (!(prefix.includes('github.com/') || prefix.includes('githubusercontent.com/'))) {
          return true;
        }
        idx = content.indexOf(needle, idx + 1);
      }
      return false;
    },
    reason: 'GitHub org path reference (internal)',
  },
];

// Directory names that must not appear in package.json `files` arrays
const INTERNAL_FILE_DIRS = ['.claude', 'business', 'docs', 'scripts', 'MASTER_PLAN'];

// Source file extensions to scan
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs']);
const TEXT_SCAN_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mts',
  '.mjs',
  '.json',
  '.cjs',
  '.cts',
]);

const PRO_PACKAGE_DIRS = ['ai', 'mcp', 'editors', 'services', 'harnesses'];

const PRO_SOURCE_ALIAS_PATTERNS: SourcePattern[] = [
  {
    check: (content) => {
      // Check for relative paths into Pro source trees: ../ai/src, ../mcp/src, etc.
      for (const dir of PRO_PACKAGE_DIRS) {
        if (
          content.includes(`../${dir}/src/`) ||
          content.includes(`../${dir}/src'`) ||
          content.includes(`../${dir}/src"`)
        ) {
          return true;
        }
      }
      return false;
    },
    reason: 'relative alias into a Pro source tree',
  },
  {
    check: (content) => {
      // Check for relative import paths: '../packages/ai/src'
      // Must have ../ prefix (relative traversal) to distinguish from documentation/config references
      for (const dir of PRO_PACKAGE_DIRS) {
        if (content.includes(`../packages/${dir}/src`)) {
          return true;
        }
      }
      return false;
    },
    reason: 'relative path into packages/<pro>/src',
  },
  {
    check: (content) => {
      // Check for quoted direct source alias: '../ai/src' or "packages/ai/src"
      for (const dir of PRO_PACKAGE_DIRS) {
        if (
          content.includes(`'${dir}/src'`) ||
          content.includes(`"${dir}/src"`) ||
          content.includes(`'packages/${dir}/src'`) ||
          content.includes(`"packages/${dir}/src"`)
        ) {
          return true;
        }
      }
      return false;
    },
    reason: 'direct source alias to a Pro package',
  },
];

// =============================================================================
// File Utilities
// =============================================================================

function collectSourceFiles(dir: string, files: string[] = []): string[] {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip dist/, node_modules/, __tests__/, __mocks__/
      if (['dist', 'node_modules', '__tests__', '__mocks__', '.turbo'].includes(entry.name)) {
        continue;
      }
      collectSourceFiles(fullPath, files);
    } else if (SOURCE_EXTENSIONS.has(extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

function collectTextFiles(dir: string, files: string[] = []): string[] {
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        ['dist', 'node_modules', '.next', '.turbo', 'coverage', '.git', '.pnpm-store'].includes(
          entry.name,
        )
      ) {
        continue;
      }
      collectTextFiles(fullPath, files);
    } else if (TEXT_SCAN_EXTENSIONS.has(extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

// =============================================================================
// Helpers
// =============================================================================

const COMMERCIAL_PACKAGE_DIRS = COMMERCIAL_PACKAGES.map((p) => p.replace('@revealui/', ''));

function isPrivateOrCommercialPackage(pkgName: string): boolean {
  if (COMMERCIAL_PACKAGE_DIRS.includes(pkgName)) return true;
  const pkgJsonPath = join(PACKAGES_DIR, pkgName, 'package.json');
  if (!existsSync(pkgJsonPath)) return false;
  const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8')) as { private?: boolean };
  return pkg.private === true;
}

// =============================================================================
// Check 1: OSS packages do not import commercial packages
// =============================================================================

function checkOssImportBoundary(): string[] {
  const violations: string[] = [];

  for (const pkgName of OSS_PACKAGE_NAMES) {
    // Private packages are dev-only and not published — skip them
    if (isPrivateOrCommercialPackage(pkgName)) continue;

    const srcDir = join(PACKAGES_DIR, pkgName, 'src');
    const files = collectSourceFiles(srcDir);

    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      const relPath = relative(REPO_ROOT, file);

      for (const commercial of COMMERCIAL_PACKAGES) {
        // Check for: from '@revealui/ai' or from "@revealui/ai" or from '@revealui/ai/...'
        if (
          content.includes(`from '${commercial}'`) ||
          content.includes(`from "${commercial}"`) ||
          content.includes(`from '${commercial}/`) ||
          content.includes(`from "${commercial}/`)
        ) {
          violations.push(`  ${relPath}: OSS package imports commercial package ${commercial}`);
        }
      }
    }
  }

  return violations;
}

// =============================================================================
// Check 2: No internal dev references in published package source
// =============================================================================

function checkInternalReferences(): string[] {
  const violations: string[] = [];
  const allPackageNames = readdirSync(PACKAGES_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);

  for (const pkgName of allPackageNames) {
    // Private packages are dev-only and not published — skip them
    if (isPrivateOrCommercialPackage(pkgName)) continue;

    const srcDir = join(PACKAGES_DIR, pkgName, 'src');
    const files = collectSourceFiles(srcDir);

    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      const relPath = relative(REPO_ROOT, file);

      for (const { check, reason } of INTERNAL_SOURCE_PATTERNS) {
        if (check(content)) {
          violations.push(`  ${relPath}: contains ${reason}`);
        }
      }
    }
  }

  return violations;
}

// =============================================================================
// Check 3: Published `files` fields do not include internal directories
// =============================================================================

function checkFilesFields(): string[] {
  const violations: string[] = [];
  const allPackageNames = readdirSync(PACKAGES_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);

  for (const pkgName of allPackageNames) {
    const pkgJsonPath = join(PACKAGES_DIR, pkgName, 'package.json');
    if (!existsSync(pkgJsonPath)) continue;

    const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8')) as {
      files?: string[];
      private?: boolean;
    };

    // Skip private packages (harnesses, editors, etc.) — they're not published
    if (pkg.private) continue;

    const files = pkg.files ?? [];
    for (const entry of files) {
      for (const internalDir of INTERNAL_FILE_DIRS) {
        if (entry.includes(internalDir)) {
          violations.push(
            `  packages/${pkgName}/package.json: "files" includes internal path "${entry}"`,
          );
        }
      }
    }
  }

  return violations;
}

// =============================================================================
// Check 4: Public repo files do not alias directly into Pro source trees
// =============================================================================

function checkProSourceAliases(): string[] {
  const violations: string[] = [];
  const files = [
    ...collectTextFiles(APPS_DIR),
    ...collectTextFiles(SCRIPTS_DIR),
    ...collectTextFiles(join(PACKAGES_DIR, 'dev')),
  ];

  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    const relPath = relative(REPO_ROOT, file);

    // Skip files that contain pattern definitions (not actual violations)
    if (relPath === 'scripts/validate/structure.ts' || relPath === 'scripts/validate/boundary.ts') {
      continue;
    }

    for (const { check, reason } of PRO_SOURCE_ALIAS_PATTERNS) {
      if (check(content)) {
        violations.push(`  ${relPath}: contains ${reason}`);
      }
    }
  }

  return violations;
}

// =============================================================================
// Check 5: Public repo files do not hard-require optional Pro packages
// =============================================================================

function checkPublicRepoProDependencies(): string[] {
  const violations: string[] = [];
  const files = [
    ...collectSourceFiles(APPS_DIR),
    ...collectSourceFiles(SCRIPTS_DIR),
    ...collectSourceFiles(join(PACKAGES_DIR, 'dev')),
  ];

  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    const relPath = relative(REPO_ROOT, file);
    const lines = content.split('\n');

    for (const packageName of COMMERCIAL_PACKAGES) {
      // Check each line for static import/export of a Pro package
      for (const line of lines) {
        const trimmed = line.trimStart();
        // Skip non-import/export lines early
        if (!(trimmed.startsWith('import') || trimmed.startsWith('export'))) continue;
        // Skip dynamic imports: import('...') — these are intentional for feature gating
        if (trimmed.startsWith('import(')) continue;
        // Static imports have a space after 'import': import { ... } from '...'
        // Static exports: export { ... } from '...'
        if (trimmed.startsWith('import') && !trimmed.startsWith('import ')) continue;
        if (trimmed.startsWith('export') && !trimmed.startsWith('export ')) continue;
        // Check if the line references this Pro package
        if (
          trimmed.includes(`'${packageName}'`) ||
          trimmed.includes(`"${packageName}"`) ||
          trimmed.includes(`'${packageName}/`) ||
          trimmed.includes(`"${packageName}/`)
        ) {
          violations.push(
            `  ${relPath}: hard static import/export of optional Pro package ${packageName}`,
          );
          break; // One violation per file per package is enough
        }
      }
    }
  }

  const manifestPaths = [
    join(REPO_ROOT, 'package.json'),
    ...readdirSync(APPS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(APPS_DIR, entry.name, 'package.json')),
    ...readdirSync(PACKAGES_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(PACKAGES_DIR, entry.name, 'package.json')),
  ].filter((pkgPath) => existsSync(pkgPath));

  for (const pkgPath of manifestPaths) {
    const relPath = relative(REPO_ROOT, pkgPath);
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    for (const depType of ['dependencies', 'devDependencies'] as const) {
      const deps = pkg[depType] ?? {};
      for (const commercial of COMMERCIAL_PACKAGES) {
        if (commercial in deps) {
          violations.push(
            `  ${relPath}: ${depType}.${commercial} hard-requires an optional Pro package`,
          );
        }
      }
    }
  }

  return violations;
}

// =============================================================================
// Main
// =============================================================================

function main(): void {
  const Sep = '='.repeat(60);
  console.log(`\n${Sep}`);
  console.log('Internal/Productized Boundary Validation (Phase 2.11)');
  console.log(Sep);

  const allViolations: string[] = [];

  console.log('\n→ Check 1: OSS packages do not import commercial packages');
  const importViolations = checkOssImportBoundary();
  if (importViolations.length === 0) {
    console.log('  ✓ No cross-license import violations');
  } else {
    for (const v of importViolations) console.log(v);
    allViolations.push(...importViolations);
  }

  console.log('\n→ Check 2: No internal dev references in package source');
  const refViolations = checkInternalReferences();
  if (refViolations.length === 0) {
    console.log('  ✓ No internal references found in published package source');
  } else {
    for (const v of refViolations) console.log(v);
    allViolations.push(...refViolations);
  }

  console.log('\n→ Check 3: Package `files` fields are clean');
  const filesViolations = checkFilesFields();
  if (filesViolations.length === 0) {
    console.log('  ✓ All package `files` fields are clean');
  } else {
    for (const v of filesViolations) console.log(v);
    allViolations.push(...filesViolations);
  }

  console.log('\n→ Check 4: Public repo files do not alias into Pro source trees');
  const aliasViolations = checkProSourceAliases();
  if (aliasViolations.length === 0) {
    console.log('  ✓ No Pro source-tree aliases found in apps/scripts/shared config');
  } else {
    for (const v of aliasViolations) console.log(v);
    allViolations.push(...aliasViolations);
  }

  console.log('\n→ Check 5: Public repo does not hard-require optional Pro packages');
  const publicRepoViolations = checkPublicRepoProDependencies();
  if (publicRepoViolations.length === 0) {
    console.log('  ✓ No static Pro imports or hard Pro manifest dependencies found');
  } else {
    for (const v of publicRepoViolations) console.log(v);
    allViolations.push(...publicRepoViolations);
  }

  console.log(`\n${Sep}`);

  if (allViolations.length > 0) {
    console.log(`✗ Boundary validation: ${allViolations.length} violation(s) found`);
    console.log(Sep);
    process.exit(1);
  }

  console.log('✓ Boundary validation passed — internal/productized boundary is clean');
  console.log(`${Sep}\n`);
}

main();
