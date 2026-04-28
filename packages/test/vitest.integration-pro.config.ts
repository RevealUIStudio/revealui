import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@revealui/core': path.resolve(__dirname, '../core/src'),
      '@admin': path.resolve(__dirname, '../../apps/admin/src'),
      '@api': path.resolve(__dirname, '../../apps/server/src'),
    },
  },
  esbuild: {
    include: /\.(ts|tsx)$/,
  },
  test: {
    include: ['src/integration-pro/**/*.test.ts', 'src/integration-pro/**/*.spec.ts'],
    exclude: ['**/node_modules/**', '**/e2e/**'],
    environment: 'node',
    globals: true,
    env: {
      VITEST: 'true',
      NODE_ENV: 'test',
    },
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    isolate: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/**',
        '**/*.test.ts',
        '**/*.spec.ts',
        'dist/**',
        '**/__tests__/**',
        '**/e2e/**',
      ],
    },
  },
});
