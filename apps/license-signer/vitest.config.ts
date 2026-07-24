import { createVitestConfig } from '@revealui/dev/vitest';

export default createVitestConfig({
  testTimeout: 15_000,
  include: ['src/**/*.test.ts'],
});
