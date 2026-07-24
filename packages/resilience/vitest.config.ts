import { createVitestConfig } from '@revealui/dev/vitest';

export default createVitestConfig({
  hookTimeout: 30_000,
  thresholds: {
    lines: 60,
    functions: 60,
    branches: 55,
    statements: 60,
  },
});
