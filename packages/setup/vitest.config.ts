import { createVitestConfig } from '@revealui/dev/vitest';

export default createVitestConfig({
  thresholds: {
    lines: 60,
    functions: 60,
    branches: 55,
    statements: 60,
  },
});
