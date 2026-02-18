import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      // Point to actual revealui package
      '@revealui/core': path.resolve(__dirname, '../core/src'),
      // Allow importing from apps/cms
      '@cms': path.resolve(__dirname, '../../apps/cms/src'),
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
    exclude: ['src/integration/**', '**/e2e/**', '**/node_modules/**'], // Exclude integration tests - they use separate config
    environment: 'node',
    globals: true,
    env: {
      VITEST: 'true',
      NODE_ENV: 'test',
    },
    // Unit tests can run in parallel (no shared state)
    pool: 'threads',
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
        statements: 70,
        branches: 60,
        functions: 70,
        lines: 70,
      },
    },
  },
})
