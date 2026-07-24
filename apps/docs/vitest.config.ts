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
