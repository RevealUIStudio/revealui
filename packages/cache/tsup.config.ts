import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/adapters/index.ts'],
  format: ['esm'],
  dts: false,
  sourcemap: false,
  clean: true,
  external: ['react', '@electric-sql/pglite'],
});
