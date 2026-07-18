import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/runtime/index.ts', 'src/canvas/index.ts'],
  format: ['esm'],
  dts: true,
  splitting: false,
  sourcemap: false,
  clean: true,
  external: ['react', 'react-dom', 'react/jsx-runtime', /^@revealui\//],
  esbuildOptions(options) {
    options.jsx = 'automatic';
  },
});
