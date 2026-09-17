#!/usr/bin/env node
/**
 * List public packages/* that are not yet on registry.npmjs.org.
 *
 * OIDC trusted publishing and `npm stage publish` both require the package
 * name to already exist (npm docs 2026-09). A brand-new name cannot be
 * created by release.yml. First publish is owner-gated: interactive 2FA
 * once, then register the GitHub Actions trusted publisher, then OIDC.
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
console.log(`
First-publish bootstrap (owner, 2FA, no long-lived NPM_TOKEN):
  1. From a built checkout of main: npm login (interactive 2FA)
  2. pnpm --filter <pkg> publish --access public --provenance
  3. On npmjs.com → package Settings → Trusted Publisher:
       GitHub Actions / RevealUIStudio / revealui / release.yml / env npm-publish
       After 2026-09-03, new configs default to npm stage publish; also allow
       npm publish only if this package must skip staging.
  4. Publishing access: require 2FA and disallow tokens
  5. Further versions: gh workflow run release.yml --ref main
`);
process.exit(STRICT ? 1 : 0);
