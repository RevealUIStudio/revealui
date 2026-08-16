#!/usr/bin/env node
/**
 * Print one private sync-manifest path for shell wrappers.
 * Usage: node scripts/sync/print-manifest-path.ts vercel|fly|staging
 */

import { type ManifestKind, requireManifestPath } from './resolve-manifest-dir.js';

const kind = process.argv[2];
if (kind !== 'vercel' && kind !== 'fly' && kind !== 'staging') {
  process.stderr.write('usage: print-manifest-path.ts vercel|fly|staging\n');
  process.exit(2);
}

process.stdout.write(`${requireManifestPath(kind as ManifestKind)}\n`);
