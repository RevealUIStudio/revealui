#!/usr/bin/env tsx
/**
 * Hard-fail: marketing CMS block derivation must stay modular.
 *
 * - `app/lib/page-blocks.ts` is a pure re-export shell (no derivation bodies).
 * - Every VES page lives in `app/lib/page-blocks/pages/*.ts` with a *PageSeed export.
 * - No second mono array of PAGE_SEEDS in seed-fleet-marketing-site.ts.
 *
 * Prevents the fair-source / services / hiw / managed cascade of merge conflicts.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const shellPath = join(root, 'apps/marketing/app/lib/page-blocks.ts');
const pagesDir = join(root, 'apps/marketing/app/lib/page-blocks/pages');
const indexPath = join(root, 'apps/marketing/app/lib/page-blocks/index.ts');
const seedPath = join(root, 'scripts/seed-fleet-marketing-site.ts');

let failed = false;
function fail(msg: string): void {
  console.error(`✗ ${msg}`);
  failed = true;
}

const shell = readFileSync(shellPath, 'utf8');
if (/function \w+Block\s*\(/.test(shell) || /export function \w+Blocks\s*\(/.test(shell)) {
  fail(
    'page-blocks.ts must remain a re-export shell (found block derivation). Put new pages in page-blocks/pages/<slug>.ts',
  );
}
if (
  !shell.includes("from './page-blocks/index'") &&
  !shell.includes('from "./page-blocks/index"')
) {
  fail('page-blocks.ts must re-export ./page-blocks/index');
}

if (!existsSync(pagesDir)) {
  fail('missing apps/marketing/app/lib/page-blocks/pages/');
} else {
  const pages = readdirSync(pagesDir).filter((n) => n.endsWith('.ts') && !n.endsWith('.test.ts'));
  if (pages.length === 0) fail('page-blocks/pages/ has no page modules');
  const index = readFileSync(indexPath, 'utf8');
  for (const file of pages) {
    const id = file.replace(/\.ts$/, '');
    if (!index.includes(`./pages/${id}`)) {
      fail(`page-blocks/index.ts must re-export ./pages/${id}`);
    }
    const body = readFileSync(join(pagesDir, file), 'utf8');
    if (!/export const \w+PageSeed\b/.test(body)) {
      fail(`pages/${file} must export const <name>PageSeed for seed auto-discovery`);
    }
  }
  console.log(`✓ ${pages.length} page module(s) registered`);
}

const seed = readFileSync(seedPath, 'utf8');
if (
  /const PAGE_SEEDS:\s*readonly/.test(seed) ||
  /slug:\s*'home'[\s\S]*blocks:\s*homeBlocks\(/.test(seed)
) {
  fail(
    'seed-fleet-marketing-site.ts must not hand-maintain PAGE_SEEDS array; use loadFleetMarketingPageSeeds()',
  );
}
if (!seed.includes('loadFleetMarketingPageSeeds')) {
  fail('seed-fleet-marketing-site.ts must call loadFleetMarketingPageSeeds()');
}

if (failed) {
  console.error('\npage-blocks modules gate FAILED');
  process.exit(1);
}
console.log('✓ page-blocks modular layout OK');
