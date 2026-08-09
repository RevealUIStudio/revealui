/**
 * Vitest config for integration tests that require a live LLM or database.
 *
 * Run:
 *   pnpm --filter @revealui/ai test:integration          # uses Ollama if running locally
 *   GROQ_API_KEY=gsk_... pnpm --filter @revealui/ai test:integration
 *
 * OpenAI is intentionally excluded  -  not authorized until business has paying customers.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/integration/**/*.test.ts'],
    testTimeout: 120_000,
  },
  // @revealui/* resolves via the install graph (workspace deps + package exports).
});
