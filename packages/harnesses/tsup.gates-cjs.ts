import { defineConfig } from 'tsup';

/**
 * CJS gates bundle — single sparse-CI contract.
 *
 * Used by:
 *   - full package build (second step after ESM in package.json "build")
 *   - package.json "build:gates" after the shared ESM/types build
 *   - security-review-gate / sec-audit-label-guard / archive-check sparse jobs,
 *     which call this config directly to avoid full package declaration builds
 *
 * gates-resolver.cjs requires `dist/gates/index.cjs` only (package is
 * "type":"module"; require of a .js gates file is not supported).
 * Do not replace the direct CJS config call with the build:gates script in
 * sparse checkouts (hooks import @revealui/security after GAP-381).
 */
export default defineConfig({
  entry: {
    'gates/index': 'src/gates/index.ts',
  },
  format: ['cjs'],
  dts: false,
  sourcemap: false,
  clean: false,
});
