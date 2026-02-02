import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [path.resolve(__dirname, './src/__tests__/setup.ts')],
    env: {
      // CRITICAL: Skip env validation during tests
      SKIP_ENV_VALIDATION: 'true',
      NODE_ENV: 'test',
      REVEALUI_SECRET: 'test-secret-key-for-testing-only-32chars',
      REVEALUI_PUBLIC_SERVER_URL: 'http://localhost:4000',
      DATABASE_URL: '', // Use SQLite for tests
      SKIP_ONINIT: 'true',
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
        statements: 70,
        branches: 60,
        functions: 70,
        lines: 70,
      },
    },
  },
  resolve: {
    alias: {
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
})
