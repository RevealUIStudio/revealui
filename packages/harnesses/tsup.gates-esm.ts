import { defineConfig } from 'tsup';

/** Sparse, runtime-only ESM build for services that consume the shared gates contract. */
export default defineConfig({
  entry: { 'gates/index': 'src/gates/index.ts' },
  format: ['esm'],
  platform: 'node',
  target: 'node24',
  dts: true,
  sourcemap: false,
  clean: false,
});
