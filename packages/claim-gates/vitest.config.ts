import { createVitestConfig } from '@revealui/dev/vitest';

export default createVitestConfig({
  testTimeout: 30_000,
  hookTimeout: 30_000,
  coverageReporters: ['text', 'json'],
  coverageExclude: ['src/**/*.test.ts', 'src/**/*.spec.ts', 'src/cli.ts'],
});
