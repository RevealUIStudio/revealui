import { createVitestConfig } from '@revealui/dev/vitest';

export default createVitestConfig({
  coverageExclude: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
  thresholds: {
    lines: 50,
    functions: 35,
    branches: 20,
    statements: 50,
  },
});
