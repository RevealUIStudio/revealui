import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Allow empty test suite until tests are added
    passWithNoTests: true,
  },
})
