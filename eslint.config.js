import sharedConfig from './packages/dev/src/eslint/eslint.config.js'

export default {
  ...sharedConfig,
  ignores: [
    'node_modules/',
    'dist/',
    'apps/web/dist/',
    'apps/cms/dist/',
    'packages/reveal/dist/',
    'packages/dev/dist/',
    'packages/services/dist/',
    'packages/revealui/dist/',
    'packages/revealui/cms/dist/',
    'build/',
    'env.d.ts',
    '.env',
    '.env.development.local',
    '.env.test.local',
    '.env.production.local',
    '.vite/',
    'framework/',
    '.next/',
  ],
}
