import { createVitestConfig } from '@revealui/dev/vitest';

export default createVitestConfig({
  hookTimeout: 15_000,
  thresholds: {
    lines: 70,
    functions: 70,
    branches: 60,
    statements: 70,
  },
});
