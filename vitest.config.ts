import { defineConfig } from 'vitest/config'

export default defineConfig({
  projects: [
    'apps/cms/vitest.config.ts',
    'apps/docs/vitest.config.ts',
    'apps/web/vitest.config.ts',
    'packages/core/vitest.config.ts',
    'packages/dev/vitest.config.ts',
    //'test/vitest.integration.config.ts',
    //'test/vitest.config.ts',
    'packages/contracts/vitest.config.ts',
    'packages/presentation/vitest.config.ts',
    'packages/auth/vitest.config.ts',
    'packages/services/vitest.config.ts',
    //'__tests__/vitest.config.ts',
  ],
})
