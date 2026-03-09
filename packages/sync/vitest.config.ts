import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom', // React hooks need DOM
    setupFiles: ['./src/test-setup.ts'],
    // Increased timeout to prevent worker init failures under full monorepo parallel load
    testTimeout: 30_000,
    hookTimeout: 30_000,
    pool: 'threads',
    poolOptions: {
      threads: {
        // Single thread avoids resource contention when turbo runs 29 packages in parallel
        maxThreads: 1,
        minThreads: 1,
      },
    },
    coverage: {
      provider: 'v8',
      // Standardized reporters: text (CI logs), json (programmatic), html (local dev), lcov (Codecov)
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
      thresholds: {
        statements: 60,
        branches: 50,
        functions: 60,
        lines: 60,
      },
    },
  },
  resolve: {
    alias: {
      '@revealui/db': path.resolve(__dirname, '../db/src'),
      '@revealui/contracts': path.resolve(__dirname, '../contracts/src'),
    },
  },
})
