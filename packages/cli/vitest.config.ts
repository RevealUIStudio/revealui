import { createVitestConfig } from '@revealui/dev/vitest';

export default createVitestConfig({
  testTimeout: 15_000,
  exclude: ['**/node_modules/**', '**/dist/**', '**/templates/**'],
  coverageInclude: ['src/**/*.{ts,tsx}'],
  coverageReporters: ['text', 'json-summary', 'html'],
  coverageExclude: [
    'src/**/*.test.ts',
    'src/**/*.spec.ts',
    'src/**/__tests__/**',
    'src/cli.ts',
    'src/index.ts',
    'dist/**',
    'node_modules/**',
    'templates/**',
  ],
  thresholds: {
    lines: 45,
    functions: 55,
    branches: 35,
    statements: 45,
  },
  overrides: {
    test: {
      coverage: {
        all: true,
      },
    },
  },
});
