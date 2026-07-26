import { createVitestConfig } from '@revealui/dev/vitest';

export default createVitestConfig({
  thresholds: {
    lines: 70,
    functions: 70,
    branches: 65,
    statements: 70,
  },
});
