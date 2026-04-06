import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    pool: 'forks',
    maxWorkers: 2,
    exclude: [
      'node_modules/**',
      '.direnv/**',
      '.claude/**',
      // Integration tests requiring PayloadCMS + database — run via pnpm test:integration
      'src/__tests__/auth/access-control.test.ts',
      'src/__tests__/auth/authentication.test.ts',
    ],
    setupFiles: [path.resolve(__dirname, './src/__tests__/setup.ts')],
    env: {
      // CRITICAL: Skip env validation during tests
      SKIP_ENV_VALIDATION: 'true',
      NODE_ENV: 'test',
      REVEALUI_SECRET: 'test-secret-key-for-testing-only-32chars',
      REVEALUI_PUBLIC_SERVER_URL: 'http://localhost:4000',
      // Force in-memory storage by unsetting database URLs that may leak from direnv/nix shell
      POSTGRES_URL: '',
      DATABASE_URL: '',
      SKIP_ONINIT: 'true',
    },
    server: {
      deps: {
        // Inline all @revealui/* workspace packages so Vite's resolver (and
        // alias map) applies to their transitive imports too. Without this,
        // Node.js native ESM loads them directly and the @revealui/config
        // alias is bypassed, causing "Cannot find module ./loader" errors
        // from the extensionless imports that tsc emits under moduleResolution:bundler.
        inline: [/@revealui\//],
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
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
    },
  },
  resolve: {
    alias: {
      // Force workspace package resolution for @revealui/* packages.
      // Without these, pnpm may resolve to a stale published version in the
      // store (e.g. @revealui/config@0.2.0) whose dist/index.js contains
      // extensionless relative imports that Node ESM rejects at test-time.
      // Pointing directly at source lets Vitest's transform handle them.
      // IMPORTANT: subpath aliases must come BEFORE the broad prefix alias or
      // Vite appends the subpath suffix to the file path → ENOTDIR.
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
      '@/utilities': path.resolve(__dirname, './src/lib/utilities'),
      '@/globals': path.resolve(__dirname, './src/lib/globals'),
      '@/heros': path.resolve(__dirname, './src/lib/heros'),
      '@/lib': path.resolve(__dirname, './src/lib'),
    },
  },
});
