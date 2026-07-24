import * as path from 'node:path';
import { createVitestConfig } from '@revealui/dev/vitest';

export default createVitestConfig({
  hookTimeout: 30_000,
  coverageExclude: [
    'src/**/*.test.ts',
    'src/**/*.spec.ts',
    'src/**/__tests__/**',
    'dist/**',
    'node_modules/**',
  ],
  thresholds: {
    lines: 70,
    functions: 70,
    branches: 65,
    statements: 70,
  },
  overrides: {
    test: {
      env: {
        POSTGRES_URL: '',
        DATABASE_URL: '',
      },
    },
    resolve: {
      alias: {
        '@revealui/contracts': path.resolve(__dirname, '../contracts/src'),
      },
    },
  },
});
