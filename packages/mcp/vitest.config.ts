import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    conditions: ['import', 'module', 'browser', 'default'],
  },
  test: {
    globals: true,
    environment: 'node',
    pool: 'forks',
    maxWorkers: 2,
    include: ['__tests__/**/*.test.ts', 'src/**/*.test.ts'],
    env: {
      // Set NODE_ENV to 'test' to skip integration tests that require database setup
      // Integration tests will check for TEST_DATABASE_URL and skip if not present
      NODE_ENV: 'test',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: ['node_modules/', 'dist/', '**/*.test.ts', '**/__tests__/**'],
    },
  },
});
