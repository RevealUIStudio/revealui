import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, './src') },
      // Resolve workspace packages from source to avoid Vite SSR export* re-export breakage.
      // Classes lose constructor identity when passed through export * chains in SSR mode.
      {
        find: '@revealui/security',
        replacement: path.resolve(__dirname, '../../packages/security/src/index.ts'),
      },
      // tsup's binary loader inlines .ttf into the production bundle, but
      // vitest can't evaluate the binary as a JS module. Alias to a tiny
      // stub so any test that transitively imports og.ts doesn't crash
      // collection. The `^.+` anchor is critical: a bare `\.ttf$` would
      // match only the extension substring and concatenate the replacement
      // onto the rest of the path; anchoring matches the full module ID so
      // the replacement takes over completely.
      //
      // No `.wasm` alias needed — og.ts reads the resvg WASM at runtime via
      // `readFileSync`, not via ESM import (see apps/api/src/routes/og.ts).
      { find: /^.+\.ttf$/, replacement: path.resolve(__dirname, './__tests__/binary-stub.ts') },
    ],
  },
  test: {
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
    environment: 'node',
    globals: true,
    pool: 'forks',
    maxWorkers: 2,
    testTimeout: 15000,
    env: {
      NODE_ENV: 'test',
      // Force in-memory storage by unsetting database URLs that may leak from direnv/nix shell
      POSTGRES_URL: '',
      DATABASE_URL: '',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: ['node_modules/**', '**/*.test.ts', '**/*.spec.ts', 'dist/**', '**/__tests__/**'],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 55,
        statements: 60,
      },
    },
  },
});
