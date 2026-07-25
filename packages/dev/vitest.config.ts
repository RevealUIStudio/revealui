import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createVitestConfig } from './src/vitest/create-config.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Self-reference source path so tests resolve before package exports are wired.
export default createVitestConfig({
  include: ['src/**/*.test.ts', 'src/**/*.integration.test.ts'],
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
        {
          find: 'dev/vitest',
          replacement: path.resolve(__dirname, './src/vitest/create-config.ts'),
        },
        { find: 'dev/biome', replacement: path.resolve(__dirname, './src/biome/biome.config.ts') },
        {
          find: 'dev/code-validator',
          replacement: path.resolve(__dirname, './src/code-validator/index.ts'),
        },
        {
          find: '@revealui/dev/vitest',
          replacement: path.resolve(__dirname, './src/vitest/create-config.ts'),
        },
        {
          find: '@revealui/dev/tailwind/create-config',
          replacement: path.resolve(__dirname, './src/tailwind/create-config.ts'),
        },
        {
          find: '@revealui/dev/tailwind',
          replacement: path.resolve(__dirname, './src/tailwind/tailwind.config.ts'),
        },
        {
          find: '@revealui/dev/postcss',
          replacement: path.resolve(__dirname, './src/postcss/postcss.config.ts'),
        },
        {
          find: '@revealui/dev/vite',
          replacement: path.resolve(__dirname, './src/vite/vite.shared.ts'),
        },
        {
          find: '@revealui/dev/biome',
          replacement: path.resolve(__dirname, './src/biome/biome.config.ts'),
        },
      ],
    },
    test: {
      env: {
        VITEST: 'true',
        NODE_ENV: 'test',
      },
    },
  },
});
