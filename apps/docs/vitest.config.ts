import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createVitestConfig } from '@revealui/dev/vitest';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default createVitestConfig({
  environment: 'jsdom',
  testTimeout: 30_000,
  hookTimeout: 30_000,
  maxWorkers: 1,
  // Tests live under app/ and __tests__/ (not packages/src default).
  include: [
    'app/**/*.{test,spec}.{ts,tsx}',
    '__tests__/**/*.{test,spec}.{ts,tsx}',
    'scripts/**/*.{test,spec}.{ts,tsx}',
  ],
  coverageExclude: [
    'app/components/showcase/registry.ts',
    'app/showcase/**/*.showcase.tsx',
    'coverage/**',
    'dist/**',
    'node_modules/**',
    '**/__tests__/**',
    '**/*.test.{ts,tsx}',
    '**/*.spec.{ts,tsx}',
    'vitest.config.ts',
  ],
  thresholds: {
    lines: 60,
    functions: 60,
    branches: 55,
    statements: 60,
  },
  overrides: {
    plugins: [react()],
    test: {
      setupFiles: ['./__tests__/setup.ts'],
      minWorkers: 1,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './app'),
      },
    },
  },
});
