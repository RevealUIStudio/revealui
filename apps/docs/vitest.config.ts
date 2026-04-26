import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./__tests__/setup.ts'],
    // Keep this package narrow under monorepo fan-out instead of raising global repo settings.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    pool: 'forks',
    maxWorkers: 1,
    minWorkers: 1,
    coverage: {
      provider: 'v8',
      // Showcase entries and the registry that loads them are pure configuration
      // (lazy-import loaders + JSX render functions consumed by the docs site at
      // runtime). They have no testable behaviour as units — they are exercised
      // by clicking through the showcase routes, which the docs E2E suite covers
      // separately. Excluding them keeps the unit coverage gate honest about
      // logic-bearing code (DocLayout, hooks, utils, components/showcase/Shell).
      exclude: [
        'app/components/showcase/registry.ts',
        'app/showcase/**/*.showcase.tsx',
        // Default vitest excludes (preserved when we override exclude)
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
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './app'),
    },
  },
});
