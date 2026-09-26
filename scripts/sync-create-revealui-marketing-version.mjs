#!/usr/bin/env node
/**
 * Keep the /templates create-revealui version pin locked to
 * packages/create-revealui/package.json.
 *
 * `pnpm changeset:version` rewrites package.json only. The marketing constant
 * is a string the client bundle inlines; this post-step rewrites that one
 * assignment. The claims entry reads TEMPLATES_CLI.body, so it follows.
 *
 * Zero authored regex: prefix search only.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkgPath = join(root, 'packages/create-revealui/package.json');
const pinPath = join(root, 'apps/marketing/app/content/templates.ts');
const marker = "export const CREATE_REVEALUI_NPM_VERSION = '";

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const version = pkg.version;
if (typeof version !== 'string' || version.length === 0 || version.includes("'")) {
  console.error('sync-create-revealui-marketing-version: package.json has no usable version');
  process.exit(1);
}

const src = readFileSync(pinPath, 'utf8');
const start = src.indexOf(marker);
if (start < 0) {
  console.error(`sync-create-revealui-marketing-version: marker missing in ${pinPath}`);
  process.exit(1);
}
const valueStart = start + marker.length;
const valueEnd = src.indexOf("'", valueStart);
if (valueEnd < 0) {
  console.error('sync-create-revealui-marketing-version: version literal is not closed');
  process.exit(1);
}

const current = src.slice(valueStart, valueEnd);
if (current === version) {
  console.log(`sync-create-revealui-marketing-version: already ${version}`);
  process.exit(0);
}

const next = `${src.slice(0, valueStart)}${version}${src.slice(valueEnd)}`;
writeFileSync(pinPath, next, 'utf8');
console.log(`sync-create-revealui-marketing-version: ${current} → ${version}`);
