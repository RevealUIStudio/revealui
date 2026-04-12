import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/logger/index.ts',
    'src/database/index.ts',
    'src/validation/index.ts',
  ],
  format: ['esm'],
  dts: true,
  sourcemap: false,
  clean: true,
});
