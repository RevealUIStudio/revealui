import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [path.resolve(__dirname, './src/__tests__/setup.ts')],
    coverage: { provider: 'v8' },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@reveal-config': path.resolve(__dirname, './revealui.config.ts'),
    },
  },
})
