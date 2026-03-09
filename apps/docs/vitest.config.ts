import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./__tests__/setup.ts'],
    // Increased timeout to prevent worker init failures under full monorepo parallel load
    testTimeout: 30_000,
    hookTimeout: 30_000,
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 1,
        minThreads: 1,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './app'),
    },
  },
})
