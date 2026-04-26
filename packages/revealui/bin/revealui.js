#!/usr/bin/env node
// revealui — meta-installer that proxies to create-revealui.
// Locates the upstream CLI via Node module resolution so it works under
// npm, pnpm, and yarn (including hoisted and isolated layouts).

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);

let binPath;
try {
  const pkgJsonPath = require.resolve('create-revealui/package.json');
  const pkg = require('create-revealui/package.json');
  const binEntry =
    typeof pkg.bin === 'string'
      ? pkg.bin
      : (pkg.bin?.['create-revealui'] ?? Object.values(pkg.bin ?? {})[0]);

  if (!binEntry) {
    throw new Error('create-revealui has no usable bin entry');
  }

  binPath = join(dirname(pkgJsonPath), binEntry);
} catch (err) {
  process.stderr.write('revealui: failed to locate the create-revealui CLI.\n');
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.stderr.write('Try running it directly:  npm create revealui\n');
  process.exit(1);
}

const result = spawnSync(process.execPath, [binPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
});

if (result.error) {
  process.stderr.write(`revealui: failed to launch create-revealui: ${result.error.message}\n`);
  process.exit(1);
}

process.exit(result.status ?? 0);
