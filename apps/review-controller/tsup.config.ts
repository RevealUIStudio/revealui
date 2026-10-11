import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node24',
  noExternal: [/^@revealui\//, /^@hono\//, 'hono', 'zod'],
  external: ['pg'],
  clean: true,
  sourcemap: false,
});
