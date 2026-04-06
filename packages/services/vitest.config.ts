import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      services: path.resolve(__dirname, './src'),
      'services/server': path.resolve(__dirname, './src/index.ts'),
      'services/client': path.resolve(__dirname, './src/client/index.ts'),
    },
  },
  define: {
    // Mock import.meta.env for webhook tests
    // This replaces import.meta.env.STRIPE_WEBHOOK_SECRET at build time
    'import.meta.env.STRIPE_WEBHOOK_SECRET': JSON.stringify(
      process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_secret',
    ),
    'import.meta.env.STRIPE_WEBHOOK_SECRET_LIVE': JSON.stringify(
      process.env.STRIPE_WEBHOOK_SECRET_LIVE || undefined,
    ),
  },
  test: {
    include: ['__tests__/**/*.test.ts', '**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    environment: 'node',
    globals: true,
    pool: 'forks',
    maxWorkers: 2,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: ['node_modules/**', '**/*.test.ts', '**/*.spec.ts', 'dist/**', '**/__tests__/**'],
      // Higher thresholds for services package due to critical business logic
      // Payment processing and third-party integrations require thorough testing
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
  },
});
