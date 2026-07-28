/*
 * size-budget.cjs — per-entry-point bundle budget. Gate 5, medium finding 12.
 * ──────────────────────────────────────────────────────────────────────────
 * A 65-component ESM package with seven entry points and no published cost per
 * import. An enterprise performance review asks "what does importing a Button
 * cost me"; today the answer is a shrug.
 *
 * This reports gzipped bytes per entry point against a checked-in baseline, and
 * fails on regression beyond a tolerance. Dependency-free — node:zlib is enough,
 * and a size gate that needs a build toolchain is a size gate people delete.
 *
 * Install as packages/presentation/scripts/size-budget.cjs:
 *
 *   "size":        "node scripts/size-budget.cjs",
 *   "size:check":  "node scripts/size-budget.cjs --check",
 *   "size:update": "node scripts/size-budget.cjs --update",
 *
 * Requires `pnpm build` first — it measures dist, because dist is what ships.
 *
 * WHAT THIS DOES NOT MEASURE, said plainly so nobody over-reads the number
 *
 * Entry-point size is not what a consumer pays. A consumer who imports one Button
 * from a tree-shakeable ESM build pays for Button and its transitive imports, not
 * for `index.js`. So treat these numbers as:
 *
 *   · a REGRESSION signal — "the barrel grew 14% this week" is always worth knowing
 *   · a TREE-SHAKING canary — see the sideEffects note below
 *   · NOT a per-component cost. For that you need a bundler probe; `--probe`
 *     prints the recipe rather than pretending this script does it.
 *
 * The tree-shaking canary is the valuable part. If `package.json` lacks
 * `"sideEffects": false`, bundlers must keep every module the barrel touches, and
 * a consumer importing one component gets most of the package. This script checks
 * for that flag and says so, because it is worth more than any byte count here.
 */
'use strict';

const { readFileSync, writeFileSync, existsSync, statSync } = require('node:fs');
const { gzipSync } = require('node:zlib');
const { join, resolve } = require('node:path');

const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const UPDATE = args.includes('--update');
const PROBE = args.includes('--probe');
const JSON_OUT = args.includes('--json');

const PKG_ROOT = resolve(join(__dirname, '..'));
const DIST = join(PKG_ROOT, 'dist');
const BASELINE = join(__dirname, 'size-budget.baseline.json');

/** Tolerance before a growth is a failure. Below this, noise from minification. */
const TOLERANCE_PCT = 3;

/** Absolute ceilings. A regression gate alone lets size creep 3% at a time forever. */
const CEILINGS = {
  '.': 420,
  './components': 400,
  './primitives': 40,
  './server': 200,
  './client': 300,
  './hooks': 60,
  './animations': 80,
};

const ENTRY_FILES = {
  '.': 'index.js',
  './components': 'components/index.js',
  './primitives': 'primitives/index.js',
  './server': 'server.js',
  './client': 'client.js',
  './hooks': 'hooks/index.js',
  './animations': 'animations/index.js',
};

if (PROBE) {
  console.log(`
Per-component cost needs a real bundler, not this script. Recipe:

  1. mkdir -p /tmp/rvui-probe && cd /tmp/rvui-probe && npm init -y
  2. npm i esbuild react react-dom @revealui/presentation
  3. For each component you care about:

     echo "export { Button } from '@revealui/presentation'" > entry.js
     npx esbuild entry.js --bundle --minify --format=esm \\
       --external:react --external:react-dom --outfile=out.js
     gzip -c out.js | wc -c

  4. Publish the table in the docs alongside the install snippet.

Do this once per release for the ten most-used components. That table is what a
performance review actually wants; entry-point size is a regression signal.
`);
  process.exit(0);
}

if (!existsSync(DIST)) {
  console.error('::error::size-budget: dist/ is missing — run `pnpm build` first.');
  process.exit(1);
}

const current = {};
const missing = [];
for (const [entry, file] of Object.entries(ENTRY_FILES)) {
  const path = join(DIST, file);
  if (!existsSync(path)) {
    missing.push(entry);
    continue;
  }
  const raw = readFileSync(path);
  current[entry] = {
    raw: statSync(path).size,
    gzip: gzipSync(raw, { level: 9 }).length,
  };
}

const pkg = JSON.parse(readFileSync(join(PKG_ROOT, 'package.json'), 'utf8'));
const sideEffects = pkg.sideEffects;
const kb = (n) => (n / 1024).toFixed(1);

if (JSON_OUT) {
  console.log(JSON.stringify({ version: pkg.version, sideEffects, sizes: current }, null, 2));
  process.exit(0);
}

if (missing.length > 0) {
  console.error(`::error::size-budget: entry point(s) not built: ${missing.join(', ')}`);
  process.exit(1);
}

/* ── write or update baseline ─────────────────────────────────────────── */

if (!existsSync(BASELINE) || UPDATE) {
  writeFileSync(BASELINE, `${JSON.stringify({ version: pkg.version, sizes: current }, null, 2)}\n`, 'utf8');
  console.log(`size-budget: baseline written for ${pkg.version}. Commit size-budget.baseline.json.\n`);
}

const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));

/* ── report ───────────────────────────────────────────────────────────── */

const rows = [];
let failed = false;

for (const entry of Object.keys(ENTRY_FILES)) {
  const now = current[entry].gzip;
  const was = baseline.sizes?.[entry]?.gzip ?? null;
  const ceiling = (CEILINGS[entry] ?? Infinity) * 1024;
  const delta = was === null ? null : ((now - was) / was) * 100;

  let status = 'ok';
  if (now > ceiling) {
    status = 'OVER CEILING';
    failed = true;
  } else if (delta !== null && delta > TOLERANCE_PCT) {
    status = 'REGRESSED';
    failed = true;
  } else if (delta !== null && delta < -TOLERANCE_PCT) {
    status = 'shrank';
  }

  rows.push({ entry, now, was, delta, ceiling, status });
}

const w = Math.max(...rows.map((r) => r.entry.length));
console.log(`\nsize-budget · @revealui/presentation@${pkg.version} · gzipped\n`);
console.log(`  ${'entry'.padEnd(w)}  ${'now'.padStart(8)}  ${'was'.padStart(8)}  ${'delta'.padStart(7)}  ceiling  status`);
for (const r of rows) {
  const delta = r.delta === null ? '—' : `${r.delta >= 0 ? '+' : ''}${r.delta.toFixed(1)}%`;
  console.log(
    `  ${r.entry.padEnd(w)}  ${`${kb(r.now)}kB`.padStart(8)}  ${(r.was === null ? '—' : `${kb(r.was)}kB`).padStart(8)}` +
      `  ${delta.padStart(7)}  ${`${(r.ceiling / 1024).toFixed(0)}kB`.padStart(7)}  ${r.status}`,
  );
}

if (sideEffects !== false) {
  console.log(
    '\n  ⚠ package.json has no `"sideEffects": false`.\n' +
      '    Without it, bundlers must retain every module the barrel touches, so a consumer\n' +
      '    importing one component can get most of the package. This matters more than any\n' +
      '    number above. Verify no module has import-time side effects, then set the flag.\n' +
      '    (Components inject their own scoped <style> on first MOUNT, not at import — that is\n' +
      '    not an import-time side effect and does not block the flag.)',
  );
}

console.log(
  '\n  Entry-point size is a regression signal, not per-component cost.\n' +
    '  For the table a performance review wants: node scripts/size-budget.cjs --probe\n',
);

if (CHECK && failed) {
  console.error(
    '::error::size-budget: a budget was exceeded.\n' +
      'If the growth is intentional, run `pnpm size:update` in the same PR so the increase is\n' +
      'reviewed as a diff rather than absorbed silently.',
  );
  process.exit(1);
}
