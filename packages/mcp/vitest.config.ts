import { createVitestConfig } from '@revealui/dev/vitest';

export default createVitestConfig({
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
