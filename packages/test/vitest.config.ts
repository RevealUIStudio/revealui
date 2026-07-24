import path from 'node:path';
import { createVitestConfig } from '@revealui/dev/vitest';

export default createVitestConfig({
  maxWorkers: 1,
  hookTimeout: 30_000,
  exclude: ['src/integration/**', 'src/integration-pro/**', '**/e2e/**', '**/node_modules/**'],
  coverageExclude: [
    'node_modules/**',
    '**/*.test.ts',
    '**/*.spec.ts',
    'dist/**',
    '**/__tests__/**',
    '**/e2e/**',
  ],
  thresholds: {
    lines: 35,
    functions: 25,
    branches: 30,
    statements: 35,
  },
  overrides: {
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
      fileParallelism: false,
      env: {
        VITEST: 'true',
        NODE_ENV: 'test',
        POSTGRES_URL: '',
        DATABASE_URL: '',
      },
    },
  },
});
