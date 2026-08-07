import { defineConfig } from 'tsup';

/**
 * Gates-only build for lightweight CI (security-review-gate, sec-audit-label-guard,
 * archive-check). Those jobs sparse-checkout only packages/harnesses + packages/dev
 * and must NOT need @revealui/security (or turbo).
 *
 * Full package `build` still runs ESM+DTS for all entries (needs security dist for
 * hooks/policy). This script emits only dist/gates for gates-resolver.cjs.
 */
export default defineConfig({
  entry: {
    'gates/index': 'src/gates/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: false,
  sourcemap: false,
  clean: false,
});
