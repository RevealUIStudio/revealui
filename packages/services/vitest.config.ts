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
        // Honest bar restored 2026-05-23. #1032 removed the revealcoin module +
        // its 1,656 lines of tests, which had masked pre-existing gaps in
        // src/email/index.ts and src/stripe/payment-intent.ts; #1043 had
        // temporarily lowered the floors to current-actuals as a stopgap. This
        // PR adds payment-intent + email-service failure-path tests, bringing
        // package coverage to ~87.5/82.8/79/87.9 — so the pre-#1032 bar is
        // restored rather than left lowered (closes GAP-211).
        statements: 65,
        branches: 50,
        functions: 70,
        lines: 65,
      },
    },
  },
});
