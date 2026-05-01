import path from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration for integration tests
 *
 * Runs integration tests serially in a single thread to ensure:
 * - All tests share the same database adapter instance
 * - Database singleton works correctly
 * - Data persistence across tests
 */
export default defineConfig({
  resolve: {
    alias: {
      '@revealui/core': path.resolve(__dirname, '../core/src'),
      '@admin': path.resolve(__dirname, '../../apps/admin/src'),
      '@api': path.resolve(__dirname, '../../apps/server/src'),
    },
  },
  esbuild: {
    // Let esbuild infer loader from file extension (.ts vs .tsx)
    // This prevents treating TypeScript generics as JSX in .ts files
    include: /\.(ts|tsx)$/,
  },
  test: {
    // Only run integration tests
    include: ['src/integration/**/*.test.ts', 'src/integration/**/*.spec.ts'],
    exclude: ['**/node_modules/**', '**/e2e/**'],
    environment: 'node',
    globals: true,
    env: {
      VITEST: 'true',
      NODE_ENV: 'test',
    },
    // CRITICAL: Run in single thread to ensure database singleton works
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true, // Single thread ensures shared singleton state
      },
    },
    // Disable file isolation for integration tests
    // This allows shared state across test files (database singleton)
    isolate: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/**',
        '**/*.test.ts',
        '**/*.spec.ts',
        'dist/**',
        '**/__tests__/**',
        '**/e2e/**',
      ],
    },
  },
});
