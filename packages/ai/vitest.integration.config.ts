/**
 * Vitest config for integration tests that require a live LLM or database.
 *
 * Run:
 *   pnpm --filter @revealui/ai test:integration          # uses Ollama if running locally
 *   GROQ_API_KEY=gsk_... pnpm --filter @revealui/ai test:integration
 *
 * OpenAI is intentionally excluded — not authorized until business has paying customers.
 */

import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/integration/**/*.test.ts'],
    testTimeout: 120_000,
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
});
