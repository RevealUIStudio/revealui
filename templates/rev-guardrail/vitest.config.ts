import { createVitestConfig } from '@revealui/dev/vitest';

export default createVitestConfig({
  testTimeout: 15_000,
  hookTimeout: 15_000,
  coverage: false,
});
