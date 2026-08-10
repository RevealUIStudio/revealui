import { defineConfig } from 'tsup';

/**
 * ESM package build (all public entry points, including content).
 *
 * CJS for `./gates` is a second sequential step (`tsup.gates-cjs.ts`) so
 * content stays ESM-only — dual-format content hit empty-import-meta and a
 * broken snapshot path (import.meta.url). package.json only exposes
 * `require` on `./gates`.
 *
 * Run via package.json: `tsup && tsup --config tsup.gates-cjs.ts` (sequential;
 * tsup multi-config runs configs in parallel and would race with clean).
 */
export default defineConfig({
  entry: [
    'src/index.ts',
    'src/cli.ts',
    'src/workboard/index.ts',
    'src/types/index.ts',
    'src/content/index.ts',
    'src/manager/index.ts',
    'src/hooks/index.ts',
    'src/hotfix/index.ts',
    'src/tmpscript/index.ts',
    'src/gates/index.ts',
    'src/acp/index.ts',
  ],
  format: ['esm'],
  dts: false,
  sourcemap: false,
  clean: true,
});
