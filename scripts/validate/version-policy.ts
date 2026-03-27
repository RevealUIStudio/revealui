#!/usr/bin/env tsx

/**
 * Version Policy Validation
 *
 * Enforces that all version bumps go through changesets and workflows.
 * Prevents manual version strings, wildcard ranges, and loose peer deps.
 *
 * Rules:
 *   1. OSS internal deps MUST use `workspace:*` (enforced by syncpack)
 *   2. Pro peer deps MUST use caret ranges pinned to published versions (^x.y.z)
 *   3. No bare `*` version specifiers anywhere (security vulnerability)
 *   4. No `>=` or `>` ranges in peerDependencies (too loose, breaks reproducibility)
 *   5. All publishable packages must have a valid semver version field
 *
 * @dependencies
 * - node:fs - File system operations
 * - node:path - Path manipulation
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');

// Pro packages are published externally — not in the workspace
const PRO_PACKAGES = new Set([
  '@revealui/ai',
  '@revealui/mcp',
  '@revealui/editors',
  '@revealui/services',
  '@revealui/harnesses',
]);

interface Violation {
  file: string;
  rule: string;
  detail: string;
}

const violations: Violation[] = [];

function collectPackageJsonPaths(): string[] {
  const paths: string[] = [join(ROOT, 'package.json')];

  for (const dir of ['apps', 'packages']) {
    const base = join(ROOT, dir);
    if (!statSync(base, { throwIfNoEntry: false })?.isDirectory()) continue;
    for (const entry of readdirSync(base)) {
      const pkgJson = join(base, entry, 'package.json');
      if (statSync(pkgJson, { throwIfNoEntry: false })?.isFile()) {
        paths.push(pkgJson);
      }
    }
  }

  return paths;
}

function checkPackage(pkgPath: string): void {
  const rel = relative(ROOT, pkgPath);
  const raw = readFileSync(pkgPath, 'utf8');
  const pkg = JSON.parse(raw) as Record<string, unknown>;

  const name = pkg.name as string | undefined;
  const version = pkg.version as string | undefined;
  const isPrivate = pkg.private === true;

  // Rule 5: publishable packages must have valid semver
  if (!isPrivate && name?.startsWith('@revealui/')) {
    if (!(version && /^\d+\.\d+\.\d+/.test(version))) {
      violations.push({
        file: rel,
        rule: 'valid-semver',
        detail: `Publishable package "${name}" has invalid version: "${version ?? 'missing'}"`,
      });
    }
  }

  // Check all dependency types
  const depTypes = ['dependencies', 'devDependencies', 'peerDependencies'] as const;
  for (const depType of depTypes) {
    const deps = pkg[depType] as Record<string, string> | undefined;
    if (!deps) continue;

    for (const [dep, range] of Object.entries(deps)) {
      // Rule 3: no bare * wildcards (workspace:* is fine, bare * is not)
      if (range === '*') {
        violations.push({
          file: rel,
          rule: 'no-wildcard',
          detail: `${depType}.${dep} = "*" — use a pinned version or workspace:*`,
        });
      }

      // Rule 4: no >= or > in @revealui peerDependencies (too loose)
      // Ecosystem tools (typescript, vite, react, etc.) legitimately use broad ranges
      if (depType === 'peerDependencies' && dep.startsWith('@revealui/') && /^>=?/.test(range)) {
        violations.push({
          file: rel,
          rule: 'no-loose-peer-range',
          detail: `${depType}.${dep} = "${range}" — use ^x.y.z for reproducible installs`,
        });
      }

      // Rule 2a: Pro peer deps must not use workspace:*
      if (PRO_PACKAGES.has(dep) && range === 'workspace:*') {
        violations.push({
          file: rel,
          rule: 'pro-peer-no-workspace',
          detail: `${dep} is a Pro package (not in workspace) — use ^x.y.z, not workspace:*`,
        });
      }

      // Rule 2b: Pro package deps must use caret ranges (^x.y.z), not exact pins or tildes
      if (PRO_PACKAGES.has(dep) && range !== 'workspace:*' && !range.startsWith('^')) {
        violations.push({
          file: rel,
          rule: 'pro-peer-use-range',
          detail: `${dep} = "${range}" — Pro packages must use caret ranges (^x.y.z) to allow compatible updates`,
        });
      }

      // Rule 1 (informational): internal OSS deps should use workspace:*
      // This is primarily enforced by syncpack, but we flag it here too
      if (
        dep.startsWith('@revealui/') &&
        !PRO_PACKAGES.has(dep) &&
        depType !== 'peerDependencies' &&
        range !== 'workspace:*'
      ) {
        violations.push({
          file: rel,
          rule: 'workspace-protocol',
          detail: `${depType}.${dep} = "${range}" — internal OSS packages must use workspace:*`,
        });
      }
    }
  }
}

// Run validation
console.log('Validating version policy...\n');

const pkgPaths = collectPackageJsonPaths();
for (const p of pkgPaths) {
  checkPackage(p);
}

if (violations.length === 0) {
  console.log(`  ✓ ${pkgPaths.length} package.json files checked — all clean\n`);
  console.log('Version policy: PASS');
} else {
  console.log(`  ✗ ${violations.length} violation(s) found:\n`);
  for (const v of violations) {
    console.log(`  [${v.rule}] ${v.file}`);
    console.log(`    ${v.detail}\n`);
  }
  console.log('Version policy: FAIL');
  console.log('\nAll version changes must go through changesets:');
  console.log('  pnpm changeset          # create a changeset');
  console.log('  pnpm changeset:version  # apply version bumps');
  console.log('  pnpm release:oss        # publish OSS packages');
  console.log('  pnpm release:pro        # publish Pro packages');
  process.exit(1);
}
