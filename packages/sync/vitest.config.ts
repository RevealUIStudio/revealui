import path from 'node:path';
import { createVitestConfig } from '@revealui/dev/vitest';

export default createVitestConfig({
  environment: 'jsdom',
  testTimeout: 30_000,
  hookTimeout: 30_000,
  coverageInclude: ['src/**/*.ts', 'src/**/*.tsx'],
  coverageExclude: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  thresholds: {
    lines: 60,
    functions: 60,
    branches: 55,
    statements: 60,
  },
  overrides: {
    test: {
      setupFiles: ['./src/test-setup.ts'],
      env: {
        POSTGRES_URL: '',
        DATABASE_URL: '',
      },
      maxConcurrency: 1,
    },
    resolve: {
      alias: {
        '@revealui/db': path.resolve(__dirname, '../db/src'),
        '@revealui/contracts': path.resolve(__dirname, '../contracts/src'),
      },
    },
  },
});
