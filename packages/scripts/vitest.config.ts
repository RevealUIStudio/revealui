import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    hookTimeout: 30000,
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@revealui/contracts/security': resolve(__dirname, '../contracts/src/security/index.ts'),
    },
  },
});
