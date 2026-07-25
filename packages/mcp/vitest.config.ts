import { createVitestConfig } from '@revealui/dev/vitest';

export default createVitestConfig({
  // PGlite cold start (knowledge-graph-factory + rate-limit-store) regularly
  // exceeds vitest's 5s default on CI runners; match @revealui/knowledge-graph.
  testTimeout: 30_000,
  hookTimeout: 30_000,
  include: ['__tests__/**/*.test.ts', 'src/**/*.test.ts'],
  coverageExclude: ['node_modules/', 'dist/', '**/*.test.ts', '**/__tests__/**'],
  overrides: {
    resolve: {
      conditions: ['import', 'module', 'browser', 'default'],
    },
    test: {
      env: {
        NODE_ENV: 'test',
      },
    },
  },
});
