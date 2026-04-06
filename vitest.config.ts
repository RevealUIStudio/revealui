import { freemem } from 'node:os';
import { defineConfig } from 'vitest/config';

// ---------------------------------------------------------------------------
// Resource-aware test configuration
//
// Root cause of "turbo test flakes": `turbo run test --concurrency=4` spawns
// 4 independent Vitest processes, each creating a fork pool (default workers
// = CPU count). On 3.8 GB WSL2: 4 × 8 forks × ~150 MB = ~4.8 GB → OOM.
//
// Fix: turbo concurrency=2 (package.json) + maxWorkers=2 per package.
// Worst case: 2 packages × 2 forks = 4 processes × 150 MB = 600 MB total.
//
// Turbo test caching is disabled (turbo.json cache:false) — tests always
// run fresh when explicitly invoked, eliminating stale cache hits.
// ---------------------------------------------------------------------------

// Per-package worker limit. Exported so individual configs can import it.
// CI runners (~7 GB) get more; local dev (~3.8 GB) stays tight.
const availableMb = Math.floor(freemem() / 1024 / 1024);
export const resourceAwareMaxWorkers = availableMb > 4096 ? 4 : 2;

export default defineConfig({
  test: {
    hookTimeout: 30000,
    exclude: ['**/.direnv/**', '**/.claude/**', '**/node_modules/**', '**/dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      exclude: [
        '**/__tests__/**',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.spec.ts',
        '**/*.spec.tsx',
        '**/node_modules/**',
        '**/dist/**',
        '**/.next/**',
        '**/coverage/**',
        '**/.turbo/**',
        '**/*.config.{ts,js,mjs}',
        '**/vitest.setup.ts',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 65,
        statements: 70,
      },
      all: true,
      include: ['**/*.{ts,tsx}'],
    },
    globals: true,
    environment: 'node',
  },
});
