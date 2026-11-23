import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'tsup';

/**
 * CJS gates bundle. Single sparse-CI contract.
 *
 * Used by:
 *   - full package build (second step after ESM in package.json "build")
 *   - package.json "build:gates" after the shared ESM/types build
 *   - security-review-gate, sec-audit-label-guard, archive-check, and
 *     trusted-gate-judge sparse jobs, which call this config directly to
 *     avoid full package declaration builds
 *
 * gates-resolver.cjs requires `dist/gates/index.cjs` only (package is
 * "type":"module"; require of a .js gates file is not supported).
 * Do not replace the direct CJS config call with the build:gates script in
 * sparse checkouts (hooks import @revealui/security after GAP-381).
 *
 * Sparse jobs check out packages/security/src and do not build that package.
 * The receipt verifier and path classifier are aliased into this file so the
 * bundle does not require @revealui/security at runtime.
 */
function securitySourceDir(): string {
  const candidates = [
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../security/src'),
    path.resolve(process.cwd(), '../security/src'),
  ];
  for (const candidate of candidates) {
    if (existsSync(path.join(candidate, 'review-receipt.ts'))) return candidate;
  }
  throw new Error('gates CJS bundle could not find packages/security/src (review-receipt.ts)');
}

const securitySrc = securitySourceDir();

export default defineConfig({
  entry: {
    'gates/index': 'src/gates/index.ts',
  },
  format: ['cjs'],
  platform: 'node',
  dts: false,
  sourcemap: false,
  clean: false,
  // bundle-require matches this package name and every subpath.
  noExternal: ['@revealui/security'],
  esbuildOptions(options) {
    options.alias = {
      ...options.alias,
      '@revealui/security/review-receipt': path.join(securitySrc, 'review-receipt.ts'),
      '@revealui/security/security-path-classifier': path.join(
        securitySrc,
        'security-path-classifier.ts',
      ),
    };
  },
});
