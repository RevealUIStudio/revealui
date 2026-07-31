import { createVitestConfig } from '@revealui/dev/vitest';

export default createVitestConfig({
  // GAP-385: PGlite cold start under turbo gate load exceeds both the 5s vitest
  // default and the previous 30s (knowledge-graph package) budget. Match the
  // GAP-274/@revealui/ai precedent (90s) so Unit Tests does not flake on
  // unrelated PRs. Suite isolation lives in the kg factory test (shared PGlite).
  testTimeout: 90_000,
  hookTimeout: 90_000,
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
