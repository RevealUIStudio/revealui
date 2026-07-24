import { resolve } from 'node:path';
import { createVitestConfig } from '@revealui/dev/vitest';

export default createVitestConfig({
  hookTimeout: 30_000,
  coverage: false,
  overrides: {
    resolve: {
      alias: {
        '@revealui/contracts/security': resolve(__dirname, '../contracts/src/security/index.ts'),
      },
    },
  },
});
