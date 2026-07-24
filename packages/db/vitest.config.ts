import { createVitestConfig } from '@revealui/dev/vitest';

export default createVitestConfig({
  maxWorkers: 1,
  hookTimeout: 30_000,
  include: ['src/**/*.test.ts', '__tests__/**/*.test.ts'],
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  coverageExclude: [
    'src/**/*.test.ts',
    'src/**/*.spec.ts',
    'src/**/__tests__/**',
    'src/**/test-fixtures.ts',
    'src/types/database.ts',
    'src/**/index.ts',
    'src/**/types.ts',
    'src/scripts/**',
    'dist/**',
  ],
  thresholds: {
    lines: 55,
    functions: 40,
    branches: 50,
    statements: 55,
  },
  overrides: {
    test: {
      fileParallelism: false,
      env: {
        POSTGRES_URL: '',
        DATABASE_URL: '',
      },
      coverage: {
        reportsDirectory: './coverage',
      },
    },
  },
});
