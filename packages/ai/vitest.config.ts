import { createVitestConfig } from '@revealui/dev/vitest';

export default createVitestConfig({
  hookTimeout: 90_000,
  testTimeout: 90_000,
  include: ['src/**/*.test.ts', 'src/**/__tests__/**/*.test.ts'],
  exclude: ['**/node_modules/**', '**/dist/**', 'src/__tests__/integration/**'],
  coverageExclude: ['src/**/*.test.ts', 'src/**/__tests__/**', 'dist/**'],
  thresholds: {
    statements: 50,
    branches: 35,
    functions: 50,
    lines: 50,
  },
  overrides: {
    test: {
      environmentMatchGlobs: [['src/client/**/*.test.ts', 'jsdom']],
    },
    // @revealui/* resolves via the install graph (workspace deps + package
    // exports). Do not path-alias into packages/*/src or dist/*.
  },
});
