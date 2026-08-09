import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/client/index.ts', 'src/stripe/index.ts', 'src/x402/index.ts'],
  format: ['esm'],
  dts: false,
  sourcemap: false,
  clean: true,
  external: ['react', 'react/jsx-runtime', 'stripe'],
});
