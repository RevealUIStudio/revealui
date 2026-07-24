import react from '@vitejs/plugin-react';
import { createVitestConfig } from '@revealui/dev/vitest';

export default createVitestConfig({
  environment: 'jsdom',
  testTimeout: 15_000,
  include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  coverageInclude: ['src/**/*.ts', 'src/**/*.tsx'],
  coverageExclude: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/__tests__/**'],
  overrides: {
    plugins: [react()],
    test: {
      setupFiles: ['./src/__tests__/setup.ts'],
    },
  },
});
