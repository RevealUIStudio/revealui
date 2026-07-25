import path from 'node:path';
import { createVitestConfig } from '@revealui/dev/vitest';

export default createVitestConfig({
  environment: 'jsdom',
  hookTimeout: 30_000,
  exclude: [
    'node_modules/**',
    '.direnv/**',
    '.claude/**',
    'src/__tests__/auth/access-control.test.ts',
    'src/__tests__/auth/authentication.test.ts',
  ],
  // Loaded-files-only coverage (no `include` key): the pre-factory config
  // had no include, so the thresholds below were calibrated against files
  // the unit tests actually load. The factory's default include put every
  // src/**/*.ts file (loaded or not) in the denominator and dropped
  // functions/branches just under threshold at the 2026-07-25 promotion
  // (#2110 migration regression, same class as @revealui/test).
  coverageInclude: false,
  coverageExclude: [
    'node_modules/**',
    'src/__tests__/**',
    '**/*.test.ts',
    '**/*.spec.ts',
    'dist/**',
    '.next/**',
  ],
  thresholds: {
    lines: 60,
    functions: 60,
    branches: 55,
    statements: 60,
  },
  overrides: {
    test: {
      setupFiles: [path.resolve(__dirname, './src/__tests__/setup.ts')],
      env: {
        SKIP_ENV_VALIDATION: 'true',
        NODE_ENV: 'test',
        REVEALUI_SECRET: 'test-secret-key-for-testing-only-32chars',
        REVEALUI_PUBLIC_SERVER_URL: 'http://localhost:4000',
        POSTGRES_URL: '',
        DATABASE_URL: '',
        SKIP_ONINIT: 'true',
      },
      server: {
        deps: {
          inline: [/@revealui\//],
        },
      },
    },
    resolve: {
      alias: {
        '@revealui/config/revealui': path.resolve(
          __dirname,
          '../../packages/config/src/revealui.config.ts',
        ),
        '@revealui/config': path.resolve(__dirname, '../../packages/config/src/index.ts'),
        '@revealui/auth/server': path.resolve(__dirname, '../../packages/auth/src/server/index.ts'),
        '@': path.resolve(__dirname, './src'),
        '@reveal-config': path.resolve(__dirname, './revealui.config.ts'),
        '@/collections': path.resolve(__dirname, './src/lib/collections'),
        '@/blocks': path.resolve(__dirname, './src/lib/blocks'),
        '@/components': path.resolve(__dirname, './src/lib/components'),
        '@/access': path.resolve(__dirname, './src/lib/access'),
        '@/hooks': path.resolve(__dirname, './src/lib/hooks'),
        '@/fields': path.resolve(__dirname, './src/lib/fields'),
        '@/globals': path.resolve(__dirname, './src/lib/globals'),
        '@/heros': path.resolve(__dirname, './src/lib/heros'),
        '@/lib': path.resolve(__dirname, './src/lib'),
        cssVariables: path.resolve(__dirname, './cssVariables.js'),
      },
    },
  },
});
