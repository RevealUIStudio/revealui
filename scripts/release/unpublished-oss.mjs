#!/usr/bin/env node
/**
 * List public packages/* that are not yet on registry.npmjs.org.
 *
 * OIDC trusted publishing and `npm stage publish` both require the package
 * name to already exist (npm docs 2026-09). A brand-new name cannot be
 * created by release.yml. The missing canonical first-publication contract is
 * owner work under GAP-501; this command reports availability only.
 *
 *   node scripts/release/unpublished-oss.mjs          # report, exit 0
 *   node scripts/release/unpublished-oss.mjs --strict # exit 1 if any unpublished
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const PACKAGES = join(ROOT, 'packages');
const STRICT = process.argv.includes('--strict');

async function npmExists(name) {
  const url = `https://registry.npmjs.org/${encodeURIComponent(name)}`;
  const res = await fetch(url, { method: 'GET', headers: { accept: 'application/json' } });
  return res.status === 200;
}

const unpublished = [];
for (const entry of readdirSync(PACKAGES, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const manifestPath = join(PACKAGES, entry.name, 'package.json');
  if (!existsSync(manifestPath)) continue;
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (manifest.private === true) continue;
  if (typeof manifest.name !== 'string') continue;
  const ok = await npmExists(manifest.name);
  if (!ok) unpublished.push(`${manifest.name}@${manifest.version}`);
}

if (unpublished.length === 0) {
  console.log('[unpublished-oss] all public packages/* exist on registry.npmjs.org');
  process.exit(0);
}

console.log('[unpublished-oss] packages not on npm (OIDC/stage cannot create them):');
for (const name of unpublished) console.log(`  - ${name}`);
console.log('\nCanonical first-publication capability is unavailable (GAP-501 owner work). release.yml cannot create these package names. This read-only report does not publish packages or provide a parallel bootstrap path.');
process.exit(STRICT ? 1 : 0);
