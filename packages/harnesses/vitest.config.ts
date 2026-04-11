import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/**/__tests__/**',
        'src/types/**',
        'src/workboard/workboard-protocol.ts',
        'src/workboard/index.ts',
        'src/cli.ts',
        'src/detection/process-detector.ts',
        'dist/**',
        'node_modules/**',
      ],
      thresholds: {
        statements: 40,
        branches: 25,
        functions: 40,
        lines: 40,
      },
    },
  },
});
