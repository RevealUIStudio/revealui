import { defineConfig } from 'tsup';

/**
 * CJS build for Claude-hook thin adapters (createRequire on `./gates` only).
 * Sequential after the ESM build — see tsup.config.ts.
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
