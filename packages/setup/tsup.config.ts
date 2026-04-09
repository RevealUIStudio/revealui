import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'environment/index': 'src/environment/index.ts',
    'utils/index': 'src/utils/index.ts',
    'validators/index': 'src/validators/index.ts',
    'bootstrap/index': 'src/bootstrap/index.ts',
  },
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  shims: true,
  target: 'node24',
  outDir: 'dist',
});
