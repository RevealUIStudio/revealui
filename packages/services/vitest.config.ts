import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      services: path.resolve(__dirname, './src'),
      'services/server': path.resolve(__dirname, './src/index.ts'),
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
      thresholds: {
        // Recalibrated 2026-05-23 after #1032 removed the revealcoin module
        // and its 4 test files (1,656 lines: client/config/oracle/safeguards),
        // which had been inflating package-wide totals. Remaining uncovered
        // code is src/email/index.ts (lines 114–345, retry/error paths) and
        // src/stripe/payment-intent.ts (lines 41–140) — pre-existing gaps
        // surfaced by the removal. Floors set to current actuals minus a 7%
        // regression buffer. Restore higher thresholds when those modules
        // gain failure-path tests (see GAP-211).
        statements: 40,
        branches: 22,
        functions: 60,
        lines: 40,
      },
    },
  },
});
