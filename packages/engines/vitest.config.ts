import { createVitestConfig } from '@revealui/dev/vitest';

export default createVitestConfig({
  // Engines facade is thin; no coverage thresholds enforced yet.
  coverage: false,
});
