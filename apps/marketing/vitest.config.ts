import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { createVitestConfig } from '@revealui/dev/vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default createVitestConfig({
  environment: 'jsdom',
  testTimeout: 30_000,
  hookTimeout: 30_000,
  maxWorkers: 1,
  coverageExclude: [
    'coverage/**',
    'dist/**',
    'node_modules/**',
    '**/__tests__/**',
    '**/*.test.{ts,tsx}',
    '**/*.spec.{ts,tsx}',
    'vitest.config.ts',
  ],
  overrides: {
    plugins: [react()],
    test: {
      minWorkers: 1,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './app'),
      },
    },
  },
});
