import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    pool: 'forks',
    include: ['src/**/*.test.ts'],
    env: {
      REVEALUI_SECRET: 'test-secret-key-for-testing-only-32chars',
      // Don't set DATABASE_URL - let auth package use in-memory storage for tests
      // Integration tests will check for DATABASE_URL and skip if not set
      NODE_ENV: 'test',
    },
    coverage: {
      provider: 'v8',
      // Standardized reporters: text (CI logs), json (programmatic), html (local dev), lcov (Codecov)
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: ['node_modules/', 'dist/', '**/*.test.ts', '**/__tests__/**'],
    },
  },
})
