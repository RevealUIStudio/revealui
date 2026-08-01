import { createVitestConfig } from '@revealui/dev/vitest';

export default createVitestConfig({
  environment: 'jsdom',
  // 2.2.5 acceptance: ≥80% on dual-mode sources (measured ~89% lines 2026-08-01).
  coverageExclude: [
    'src/**/*.test.ts',
    'src/**/*.test.tsx',
    'src/__tests__/**',
    'src/core.ts',
    'src/index.ts',
    'src/types.ts',
    'src/server.tsx',
  ],
  thresholds: {
    lines: 80,
    functions: 80,
    branches: 70,
    statements: 80,
  },
});
