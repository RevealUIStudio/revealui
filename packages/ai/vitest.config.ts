import path from 'node:path';
import { createVitestConfig } from '@revealui/dev/vitest';

export default createVitestConfig({
  hookTimeout: 90_000,
  testTimeout: 90_000,
  include: ['src/**/*.test.ts', 'src/**/__tests__/**/*.test.ts'],
  exclude: ['**/node_modules/**', '**/dist/**', 'src/__tests__/integration/**'],
  coverageExclude: ['src/**/*.test.ts', 'src/**/__tests__/**', 'dist/**'],
  thresholds: {
    statements: 50,
    branches: 35,
    functions: 50,
    lines: 50,
  },
  overrides: {
    test: {
      environmentMatchGlobs: [['src/client/**/*.test.ts', 'jsdom']],
    },
    resolve: {
      alias: {
        // More-specific @revealui/db/* entries must come before the bare
        // `@revealui/db` alias. Vite treats string aliases as prefixes, so
        // `@revealui/db` alone rewrites `@revealui/db/testing` to
        // `dist/index.js/testing` (ENOTDIR).
        '@revealui/db/schema/vector': path.resolve(__dirname, '../db/dist/schema/vector.js'),
        '@revealui/db/schema/rag': path.resolve(__dirname, '../db/dist/schema/rag.js'),
        '@revealui/db/schema': path.resolve(__dirname, '../db/dist/schema/index.js'),
        '@revealui/db/client': path.resolve(__dirname, '../db/dist/client/index.js'),
        '@revealui/db/crypto': path.resolve(__dirname, '../db/dist/crypto.js'),
        '@revealui/db/validation': path.resolve(__dirname, '../db/dist/validation/cross-db.js'),
        '@revealui/db/testing': path.resolve(__dirname, '../db/dist/testing/index.js'),
        '@revealui/db': path.resolve(__dirname, '../db/dist/index.js'),
        '@revealui/contracts': path.resolve(__dirname, '../contracts/src'),
        '@revealui/core/admin': path.resolve(__dirname, '../core/src/client/admin'),
        '@revealui/core': path.resolve(__dirname, '../core/src'),
      },
    },
  },
});
