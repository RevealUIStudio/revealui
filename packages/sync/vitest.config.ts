import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom', // Changed to jsdom for React Testing Library
    include: ['src/**/*.{test,spec}.{js,ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    setupFiles: ['./src/__tests__/setup.ts'],
    testTimeout: 30000, // 30 seconds for real API tests
  },
})
