import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Resolve workspace packages from source to avoid Vite SSR export* re-export breakage.
      // Classes lose constructor identity when passed through export * chains in SSR mode.
      '@revealui/security': path.resolve(__dirname, '../../packages/security/src/index.ts'),
    },
  },
  test: {
    include: ['__tests__/**/*.test.ts', '**/*.test.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.direnv/**',
      '**/.claude/**',
      '.direnv/**',
      '.claude/**',
      '**/*-integration.test.ts',
    ],
    environment: 'node',
    globals: true,
    pool: 'forks',
    maxWorkers: 2,
    testTimeout: 15000,
    env: {
      NODE_ENV: 'test',
      // Force in-memory storage by unsetting database URLs that may leak from direnv/nix shell
      POSTGRES_URL: '',
      DATABASE_URL: '',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: ['node_modules/**', '**/*.test.ts', '**/*.spec.ts', 'dist/**', '**/__tests__/**'],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 55,
        statements: 60,
      },
    },
  },
});
