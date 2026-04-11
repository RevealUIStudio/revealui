import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    fileParallelism: false,
    maxWorkers: 1,
    pool: 'forks',
    hookTimeout: 30000,
    env: {
      // Force in-memory storage by unsetting database URLs that may leak from direnv/nix shell
      POSTGRES_URL: '',
      DATABASE_URL: '',
    },
    include: ['src/**/*.test.ts', '__tests__/**/*.test.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**', // Exclude compiled tests - only run source tests
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/**/__tests__/**',
        'src/**/test-fixtures.ts',
        'src/types/database.ts', // Generated file
        'src/schema/**', // Declarative Drizzle pgTable/relations definitions
        'src/scripts/**', // Utility scripts (cleanup crons, etc.)
        'dist/**',
      ],
      thresholds: {
        lines: 55,
        functions: 40,
        branches: 50,
        statements: 55,
      },
    },
  },
});
