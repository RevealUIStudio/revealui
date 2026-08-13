import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node24',
  bundle: true,
  splitting: false,
  dts: false,
  sourcemap: true,
  clean: true,
  outDir: 'dist',
  // Bundle workspace packages so extensionless ESM imports resolve at build time.
  noExternal: [/^@revealui\//],
  external: [],
});
