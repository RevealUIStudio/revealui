import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom', // React hooks need DOM
    setupFiles: ['./src/test-setup.ts'],
    // Increased timeout to prevent worker init failures under full monorepo parallel load
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Forks give each test file its own process, preventing jsdom/yjs shared-state
    // contention when turbo runs 29 packages in parallel during CI gate
    pool: 'forks',
    maxWorkers: 2,
    env: {
      // Force in-memory storage by unsetting database URLs that may leak from direnv/nix shell
      POSTGRES_URL: '',
      DATABASE_URL: '',
    },
    maxConcurrency: 1,
    coverage: {
      provider: 'v8',
      // Standardized reporters: text (CI logs), json (programmatic), html (local dev), lcov (Codecov)
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
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
      '@revealui/db': path.resolve(__dirname, '../db/src'),
      '@revealui/contracts': path.resolve(__dirname, '../contracts/src'),
    },
  },
});
