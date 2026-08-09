import path from 'node:path';
import { createVitestConfig } from '@revealui/dev/vitest';

export default createVitestConfig({
  testTimeout: 15_000,
  hookTimeout: 30_000,
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
  coverageExclude: [
    'node_modules/**',
    '**/*.test.ts',
    '**/*.spec.ts',
    'dist/**',
    '**/__tests__/**',
  ],
  thresholds: {
    lines: 60,
    functions: 60,
    branches: 55,
    statements: 60,
  },
  overrides: {
    resolve: {
      alias: [
        // App-local only. @revealui/* packages resolve via the install graph
        // (dependencies + package exports) — do not path-alias into packages/*.
        { find: '@', replacement: path.resolve(__dirname, './src') },
        {
          find: /^.+\.ttf$/,
          replacement: path.resolve(__dirname, './__tests__/binary-stub.ts'),
        },
      ],
    },
    test: {
      env: {
        NODE_ENV: 'test',
        POSTGRES_URL: '',
        DATABASE_URL: '',
      },
    },
  },
});
