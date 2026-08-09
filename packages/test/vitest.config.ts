import path from 'node:path';
import { createVitestConfig } from '@revealui/dev/vitest';

export default createVitestConfig({
  maxWorkers: 1,
  hookTimeout: 30_000,
  exclude: ['src/integration/**', 'src/integration-pro/**', '**/e2e/**', '**/node_modules/**'],
  // Loaded-files-only coverage (no `include` key). This package is test
  // infrastructure: its fixtures/mocks/patterns/integration helpers are
  // exercised by OTHER packages' suites and by the integration/e2e runs this
  // unit job excludes, so an include-all denominator counts them at 0% and
  // sank the package from green to 15% lines at the 2026-07-25 promotion
  // (#2110 factory migration regression — the pre-factory config had no
  // include key and the thresholds below were calibrated to loaded-only
  // measurement).
  coverageInclude: false,
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
        // App-local test path aliases only. @revealui/* uses the install graph.
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
