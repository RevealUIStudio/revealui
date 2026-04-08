import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/__tests__/**/*.test.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'src/__tests__/integration/**', // Skip - need Neon database
    ],
    environmentMatchGlobs: [
      // Use jsdom for client-side React hook tests
      ['src/client/**/*.test.ts', 'jsdom'],
    ],
    coverage: {
      provider: 'v8',
      // Standardized reporters: text (CI logs), json (programmatic), html (local dev), lcov (Codecov)
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/__tests__/**', 'dist/**'],
      thresholds: {
        statements: 70,
        branches: 60,
        functions: 70,
        lines: 70,
      },
    },
  },
  resolve: {
    alias: {
      '@revealui/db/schema/vector': path.resolve(__dirname, '../db/dist/schema/vector.js'),
      '@revealui/db/schema/rag': path.resolve(__dirname, '../db/dist/schema/rag.js'),
      '@revealui/db/schema': path.resolve(__dirname, '../db/dist/schema/index.js'),
      '@revealui/db/client': path.resolve(__dirname, '../db/dist/client/index.js'),
      '@revealui/db/crypto': path.resolve(__dirname, '../db/dist/crypto.js'),
      '@revealui/db/validation': path.resolve(__dirname, '../db/dist/validation/cross-db.js'),
      '@revealui/db': path.resolve(__dirname, '../db/dist/index.js'),
      '@revealui/contracts': path.resolve(__dirname, '../contracts/src'),
      '@revealui/core': path.resolve(__dirname, '../core/src'),
    },
  },
});
