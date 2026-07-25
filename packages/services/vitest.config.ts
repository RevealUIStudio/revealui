import path from 'node:path';
import { createVitestConfig } from '@revealui/dev/vitest';

export default createVitestConfig({
  include: ['__tests__/**/*.test.ts', '**/*.test.ts'],
  coverageExclude: [
    'node_modules/**',
    '**/*.test.ts',
    '**/*.spec.ts',
    'dist/**',
    '**/__tests__/**',
  ],
  thresholds: {
    statements: 65,
    branches: 50,
    functions: 70,
    lines: 65,
  },
  overrides: {
    resolve: {
      alias: {
        services: path.resolve(__dirname, './src'),
        'services/server': path.resolve(__dirname, './src/index.ts'),
      },
    },
    define: {
      'import.meta.env.STRIPE_WEBHOOK_SECRET': JSON.stringify(
        process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_secret',
      ),
      'import.meta.env.STRIPE_WEBHOOK_SECRET_LIVE': JSON.stringify(
        process.env.STRIPE_WEBHOOK_SECRET_LIVE || undefined,
      ),
    },
  },
});
