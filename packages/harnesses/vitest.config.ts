import { createVitestConfig } from '@revealui/dev/vitest';

export default createVitestConfig({
  hookTimeout: 90_000,
  testTimeout: 90_000,
  coverageExclude: [
    'src/**/*.test.ts',
    'src/**/*.spec.ts',
    'src/**/__tests__/**',
    'src/types/**',
    'src/workboard/workboard-protocol.ts',
    'src/workboard/index.ts',
    'src/cli.ts',
    'src/detection/process-detector.ts',
    'dist/**',
    'node_modules/**',
  ],
  thresholds: {
    statements: 40,
    branches: 25,
    functions: 40,
    lines: 40,
  },
});
