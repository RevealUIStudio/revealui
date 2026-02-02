import path from 'node:path'
import { defineConfig } from 'vitest/config'

// TODO: Add test files for presentation package components
// Currently configured but no tests implemented yet
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: { provider: 'v8' },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
