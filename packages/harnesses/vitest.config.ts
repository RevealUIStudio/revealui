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
        statements: 55,
        branches: 35,
        functions: 55,
        lines: 55,
      },
    },
  },
});
