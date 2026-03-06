import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    pool: 'forks',
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
        'dist/**',
      ],
      thresholds: {
        branches: 55,
        functions: 45,
        lines: 55,
        statements: 55,
      },
    },
  },
})
