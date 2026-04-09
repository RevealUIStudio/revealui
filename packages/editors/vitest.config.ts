import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    pool: 'forks',
    maxWorkers: 2,
    fileParallelism: false,
    include: ['src/**/*.test.ts'],
  },
});
