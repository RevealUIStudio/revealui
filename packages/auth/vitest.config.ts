import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    env: {
      REVEALUI_SECRET: 'test-secret-key-for-testing-only-32chars',
    },
    coverage: {
      provider: 'v8',
      // Standardized reporters: text (CI logs), json (programmatic), html (local dev), lcov (Codecov)
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: ['node_modules/', 'dist/', '**/*.test.ts', '**/__tests__/**'],
    },
  },
})
