import path from 'node:path'
import { defineConfig } from 'vitest/config'

// TODO: Add test files for presentation package components
// Currently configured but no tests implemented yet
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: { provider: 'v8' },
    // Allow empty test suite until tests are added
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
