#!/usr/bin/env tsx

/**
 * Catalog → Changeset Validation
 *
 * Detects when pnpm catalog entries used as runtime dependencies in published
 * packages have changed, but no changeset exists for the affected packages.
 *
 * Only checks `dependencies` and `peerDependencies`  -  devDependencies don't
 * ship in published packages and don't need changesets.
 *
 * Usage:
 *   tsx scripts/validate/catalog-changeset.ts           # compare against HEAD~1
 *   tsx scripts/validate/catalog-changeset.ts --base main  # compare against main
 *   tsx scripts/validate/catalog-changeset.ts --warn    # warn-only (exit 0)
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');

// --- Parse args ---
const args = process.argv.slice(2);
const warnOnly = args.includes('--warn');
const baseIdx = args.indexOf('--base');
const base = baseIdx >= 0 ? (args[baseIdx + 1] ?? 'HEAD~1') : 'HEAD~1';

// --- Parse catalog from pnpm-workspace.yaml ---
interface CatalogEntries {
  [name: string]: string;
}

function parseCatalog(content: string): CatalogEntries {
  const entries: CatalogEntries = {};
  let inCatalog = false;

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === 'catalog:') {
      inCatalog = true;
      continue;
    }
    // End of catalog section (next top-level key or empty section)
    if (inCatalog && !line.startsWith(' ') && !line.startsWith('\t') && trimmed.length > 0) {
      break;
    }
    if (inCatalog && trimmed.includes(':')) {
      // Parse "  package-name: ^x.y.z" or "  '@scope/name': ^x.y.z"
      const colonIdx = trimmed.indexOf(':');
      let name = trimmed.slice(0, colonIdx).trim();
      const version = trimmed.slice(colonIdx + 1).trim();
      // Strip surrounding quotes
      if (
        (name.startsWith("'") && name.endsWith("'")) ||
        (name.startsWith('"') && name.endsWith('"'))
      ) {
        name = name.slice(1, -1);
      }
      if (name && version) {
        entries[name] = version;
      }
    }
  }
  return entries;
}

// --- Get previous catalog state from git ---
function getPreviousCatalog(): CatalogEntries {
  try {
    const content = execFileSync('git', ['show', `${base}:pnpm-workspace.yaml`], {
      encoding: 'utf8',
      cwd: ROOT,
    });
    return parseCatalog(content);
  } catch {
    // No previous version (new file or invalid base)
    return {};
  }
}

// --- Find published packages with catalog: runtime deps ---
interface PackageInfo {
  name: string;
  path: string;
  catalogDeps: string[]; // catalog entries used in dependencies/peerDependencies
}

function findPublishedPackagesWithCatalogDeps(): PackageInfo[] {
  const result: PackageInfo[] = [];
  const pkgDir = join(ROOT, 'packages');

  for (const entry of readdirSync(pkgDir)) {
    const pkgJsonPath = join(pkgDir, entry, 'package.json');
    let pkg: Record<string, unknown>;
    try {
      pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8')) as Record<string, unknown>;
    } catch {
      continue;
    }
    if (pkg.private === true) continue;

    const name = pkg.name as string;
    const catalogDeps: string[] = [];

    for (const depType of ['dependencies', 'peerDependencies'] as const) {
      const deps = pkg[depType] as Record<string, string> | undefined;
      if (!deps) continue;
      for (const [dep, range] of Object.entries(deps)) {
        if (range === 'catalog:') {
          catalogDeps.push(dep);
        }
      }
    }

    if (catalogDeps.length > 0) {
      result.push({ name, path: pkgJsonPath, catalogDeps });
    }
  }

  return result;
}

// --- Check for pending changesets ---
function getPendingChangesetPackages(): Set<string> {
  const changesetDir = join(ROOT, '.changeset');
  const packages = new Set<string>();

  if (!existsSync(changesetDir)) return packages;

  for (const file of readdirSync(changesetDir)) {
    if (!file.endsWith('.md') || file === 'README.md') continue;
    const content = readFileSync(join(changesetDir, file), 'utf8');
    // Changeset format: ---\n"@pkg/name": patch\n---\n\nDescription
    const frontmatter = content.split('---')[1];
    if (!frontmatter) continue;
    for (const line of frontmatter.split('\n')) {
      const match = line.match(/^['"]?(@?[\w/-]+)['"]?\s*:/);
      if (match) {
        packages.add(match[1]);
      }
    }
  }

  return packages;
}

// --- Main ---
const currentCatalogContent = readFileSync(join(ROOT, 'pnpm-workspace.yaml'), 'utf8');
const currentCatalog = parseCatalog(currentCatalogContent);
const previousCatalog = getPreviousCatalog();

// Find catalog entries that changed
const changedEntries: Array<{ name: string; from: string; to: string }> = [];
for (const [name, version] of Object.entries(currentCatalog)) {
  const prev = previousCatalog[name];
  if (prev && prev !== version) {
    changedEntries.push({ name, from: prev, to: version });
  }
}

if (changedEntries.length === 0) {
  console.log('  ✓ No catalog dependency changes detected\n');
  process.exit(0);
}

// Find affected published packages
const publishedPackages = findPublishedPackagesWithCatalogDeps();
const pendingChangesets = getPendingChangesetPackages();

const missingChangesets: Array<{
  packageName: string;
  changedDep: string;
  from: string;
  to: string;
}> = [];

for (const change of changedEntries) {
  for (const pkg of publishedPackages) {
    if (pkg.catalogDeps.includes(change.name) && !pendingChangesets.has(pkg.name)) {
      missingChangesets.push({
        packageName: pkg.name,
        changedDep: change.name,
        from: change.from,
        to: change.to,
      });
    }
  }
}

// Report
console.log(`  Catalog changes detected (vs ${base}):\n`);
for (const c of changedEntries) {
  console.log(`    ${c.name}: ${c.from} → ${c.to}`);
}
console.log('');

if (missingChangesets.length === 0) {
  console.log('  ✓ All affected packages have pending changesets\n');
  process.exit(0);
}

const prefix = warnOnly ? '⚠' : '✗';
console.log(`  ${prefix} ${missingChangesets.length} published package(s) need changesets:\n`);

// Group by package
const byPackage = new Map<string, string[]>();
for (const m of missingChangesets) {
  const deps = byPackage.get(m.packageName) ?? [];
  deps.push(`${m.changedDep} (${m.from} → ${m.to})`);
  byPackage.set(m.packageName, deps);
}

for (const [pkg, deps] of byPackage) {
  console.log(`    ${pkg}`);
  for (const d of deps) {
    console.log(`      └─ ${d}`);
  }
}

console.log('\n  Run: pnpm changeset');
console.log('  Then create a patch changeset for the affected packages.\n');

if (!warnOnly) {
  process.exit(1);
}
