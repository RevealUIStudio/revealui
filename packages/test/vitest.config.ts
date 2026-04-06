import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // Point to actual revealui package
      '@revealui/core': path.resolve(__dirname, '../core/src'),
      // Allow importing from apps
      '@cms': path.resolve(__dirname, '../../apps/cms/src'),
      '@api': path.resolve(__dirname, '../../apps/api/src'),
    },
  },
  esbuild: {
    // Let esbuild infer loader from file extension (.ts vs .tsx)
    // This prevents treating TypeScript generics as JSX in .ts files
    include: /\.(ts|tsx)$/,
  },
  test: {
    // Exclude E2E tests (run separately with Playwright)
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    exclude: ['src/integration/**', 'src/integration-pro/**', '**/e2e/**', '**/node_modules/**'], // Exclude integration tests - they use separate configs
    environment: 'node',
    fileParallelism: false,
    maxWorkers: 1,
    globals: true,
    env: {
      VITEST: 'true',
      NODE_ENV: 'test',
      // Force in-memory storage by unsetting database URLs that may leak from direnv/nix shell
      POSTGRES_URL: '',
      DATABASE_URL: '',
    },
    pool: 'forks',
    hookTimeout: 30000,
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
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 55,
        statements: 60,
      },
    },
  },
});
