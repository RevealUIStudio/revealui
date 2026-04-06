import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  resolve: {
    alias: [
      // More-specific subpath aliases must come before the broad prefix alias.
      // These mirror the package.json "exports" map so tests can import 'dev/*'
      // without the package being installed in node_modules.
      {
        find: 'dev/tailwind/create-config',
        replacement: path.resolve(__dirname, './src/tailwind/create-config.ts'),
      },
      {
        find: 'dev/tailwind',
        replacement: path.resolve(__dirname, './src/tailwind/tailwind.config.ts'),
      },
      {
        find: 'dev/postcss',
        replacement: path.resolve(__dirname, './src/postcss/postcss.config.ts'),
      },
      { find: 'dev/vite', replacement: path.resolve(__dirname, './src/vite/vite.shared.ts') },
      { find: 'dev/biome', replacement: path.resolve(__dirname, './src/biome/biome.config.ts') },
      {
        find: 'dev/code-validator',
        replacement: path.resolve(__dirname, './src/code-validator/index.ts'),
      },
    ],
  },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.integration.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    environment: 'node',
    globals: true,
    env: {
      VITEST: 'true',
      NODE_ENV: 'test',
    },
    pool: 'forks',
    maxWorkers: 2,
    coverage: {
      provider: 'v8',
      // Standardized reporters: text (CI logs), json (programmatic), html (local dev), lcov (Codecov)
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
