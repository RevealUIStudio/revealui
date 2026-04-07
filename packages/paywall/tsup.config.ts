import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/server/hono.ts',
    'src/server/next.ts',
    'src/client/index.ts',
    'src/stripe/index.ts',
    'src/x402/index.ts',
  ],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: ['react', 'hono', 'stripe'],
});
