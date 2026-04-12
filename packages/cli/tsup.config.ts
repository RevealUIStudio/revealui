import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: false,
  clean: true,
  shims: true,
  target: 'node24',
  outDir: 'dist',
});
