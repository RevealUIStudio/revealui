import { defineConfig } from 'vitest/config'

export default defineConfig({
  projects: [
    // Apps
    'apps/cms/vitest.config.ts',
    'apps/docs/vitest.config.ts',
    'apps/web/vitest.config.ts',

    // Packages
    'packages/ai/vitest.config.ts',
    'packages/auth/vitest.config.ts',
    'packages/contracts/vitest.config.ts',
    'packages/core/vitest.config.ts',
    'packages/dev/vitest.config.ts',
    'packages/presentation/vitest.config.ts',
    'packages/services/vitest.config.ts',
    'packages/setup/vitest.config.ts',
    'packages/sync/vitest.config.ts',
    'packages/test/vitest.config.ts',

    // Scripts tests
    'scripts/__tests__/vitest.config.ts',
  ],
})
