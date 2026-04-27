import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    pool: 'forks',
    maxWorkers: 2,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
