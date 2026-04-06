import * as path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    pool: 'forks',
    maxWorkers: 2,
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    env: {
      // Force in-memory storage by unsetting database URLs that may leak from direnv/nix shell
      POSTGRES_URL: '',
      DATABASE_URL: '',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/**/__tests__/**',
        'dist/**',
        'node_modules/**',
      ],
      // Standard thresholds for core packages
      // Balanced between code quality and development velocity
      thresholds: {
        lines: 75,
        functions: 75,
        branches: 70,
        statements: 75,
      },
    },
  },
  resolve: {
    alias: {
      '@revealui/contracts': path.resolve(__dirname, '../contracts/src'),
    },
  },
});
