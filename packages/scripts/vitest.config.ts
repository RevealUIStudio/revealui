import { resolve } from 'node:path';
import { createVitestConfig } from '@revealui/dev/vitest';

export default createVitestConfig({
  hookTimeout: 30_000,
  coverage: false,
  // Tests live at package-root __tests__/ (not under src/).
  include: ['__tests__/**/*.{test,spec}.{ts,tsx}'],
  overrides: {
    resolve: {
      alias: {
        '@revealui/contracts/security': resolve(__dirname, '../contracts/src/security/index.ts'),
      },
    },
  },
});
