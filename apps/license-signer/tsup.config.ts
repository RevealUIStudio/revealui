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
  // Bundle workspace + runtime deps so the Fly image needs only dist/.
  noExternal: [/^@revealui\//, /^@hono\//, 'hono', 'zod'],
  external: [],
});
