import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/cli.ts',
    'src/workboard/index.ts',
    'src/types/index.ts',
    'src/content/index.ts',
    'src/storage/index.ts',
  ],
  format: ['esm'],
  dts: true,
  sourcemap: false,
  clean: true,
  external: ['@electric-sql/pglite'],
});
