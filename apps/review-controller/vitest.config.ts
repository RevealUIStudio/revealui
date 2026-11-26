import { createVitestConfig } from '@revealui/dev/vitest';

// Each database fixture owns an in-process PostgreSQL engine. Serialize this
// package so local and hosted validation do not multiply those memory costs.
export default createVitestConfig({
  include: ['src/**/*.test.ts'],
  maxWorkers: 1,
  overrides: { test: { fileParallelism: false } },
});
