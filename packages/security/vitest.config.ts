import { createVitestConfig } from '@revealui/dev/vitest';

export default createVitestConfig({
  thresholds: {
    lines: 70,
    functions: 65,
    branches: 65,
    statements: 70,
  },
});
