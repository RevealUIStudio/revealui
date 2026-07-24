import { createVitestConfig } from '@revealui/dev/vitest';

export default createVitestConfig({
  maxWorkers: 1,
  include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  coverageExclude: ['node_modules/', 'dist/', '**/*.test.ts', '**/__tests__/**'],
  thresholds: {
    lines: 75,
    functions: 75,
    branches: 65,
    statements: 75,
  },
  overrides: {
    test: {
      environmentMatchGlobs: [['**/*.test.tsx', 'happy-dom']],
      fileParallelism: false,
      env: {
        REVEALUI_SECRET: 'test-secret-key-for-testing-only-32chars',
        POSTGRES_URL: '',
        DATABASE_URL: '',
        NODE_ENV: 'test',
      },
    },
  },
});
