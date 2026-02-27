import { defineConfig } from 'vitest/config'

export default defineConfig({
  projects: [
    // Apps
    'apps/cms/vitest.config.ts',
    'apps/docs/vitest.config.ts',
    'apps/mainframe/vitest.config.ts',

    // Packages
    'packages/ai/vitest.config.ts',
    'packages/auth/vitest.config.ts',
    'packages/contracts/vitest.config.ts',
    'packages/core/vitest.config.ts',
    'packages/db/vitest.config.ts',
    'packages/dev/vitest.config.ts',
    'packages/presentation/vitest.config.ts',
    'packages/services/vitest.config.ts',
    'packages/setup/vitest.config.ts',
    'packages/sync/vitest.config.ts',
    'packages/test/vitest.config.ts',
    'packages/editor-sdk/vitest.config.ts',
    'packages/editor-daemon/vitest.config.ts',

    // Scripts tests
    'scripts/__tests__/vitest.config.ts',
  ],
  test: {
    hookTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      exclude: [
        '**/__tests__/**',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.spec.ts',
        '**/*.spec.tsx',
        '**/node_modules/**',
        '**/dist/**',
        '**/.next/**',
        '**/coverage/**',
        '**/.turbo/**',
        '**/*.config.{ts,js,mjs}',
        '**/vitest.setup.ts',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 65,
        statements: 70,
      },
      all: true,
      include: ['**/*.{ts,tsx}'],
    },
    globals: true,
    environment: 'node',
  },
})
