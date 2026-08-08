import { defineConfig } from 'tsup';

/**
 * CJS gates bundle — single sparse-CI contract.
 *
 * Used by:
 *   - full package build (second step after ESM+DTS in package.json "build")
 *   - package.json "build:gates" (alias)
 *   - security-review-gate / sec-audit-label-guard / archive-check sparse jobs
 *
 * gates-resolver.cjs requires `dist/gates/index.cjs` only (package is
 * "type":"module"; require of a .js gates file is not supported).
 * Do not replace this with full-package DTS builds in sparse checkouts
 * (hooks import @revealui/security after GAP-381).
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
