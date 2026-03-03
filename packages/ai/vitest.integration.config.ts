/**
 * Vitest config for integration tests that require real API keys or a Neon database.
 *
 * Run:
 *   OPENAI_API_KEY=sk-... pnpm --filter @revealui/ai test:integration
 *   GROQ_API_KEY=gsk_... pnpm --filter @revealui/ai test:integration
 */

import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/integration/**/*.test.ts'],
    testTimeout: 60_000,
  },
  resolve: {
    alias: {
      '@revealui/db/schema/vector': path.resolve(__dirname, '../db/dist/schema/vector.js'),
      '@revealui/db/schema': path.resolve(__dirname, '../db/dist/schema/index.js'),
      '@revealui/db/client': path.resolve(__dirname, '../db/dist/client/index.js'),
      '@revealui/db': path.resolve(__dirname, '../db/dist/index.js'),
      '@revealui/contracts': path.resolve(__dirname, '../contracts/src'),
      '@revealui/core': path.resolve(__dirname, '../core/src'),
    },
  },
})
