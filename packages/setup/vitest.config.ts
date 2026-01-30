import { defineConfig } from 'vitest/config'

// TODO: Add test files for setup package utilities
// Currently configured but no tests implemented yet
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Allow empty test suite until tests are added
    passWithNoTests: true,
  },
})
