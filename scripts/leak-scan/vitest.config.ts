import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Self-contained so the tool's tests run independently of the monorepo root
// config: `vitest run --config scripts/leak-scan/vitest.config.ts`.
export default defineConfig({
  test: {
    environment: 'node',
    root: fileURLToPath(new URL('.', import.meta.url)),
    include: ['**/*.test.ts'],
    exclude: ['**/node_modules/**'],
  },
});
