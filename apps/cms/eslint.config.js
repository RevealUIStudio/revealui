import sharedConfig from '../../packages/dev/src/eslint/eslint.config.js'
export default [
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.turbo/**',
      '**/.next/**',
      'test-import.ts',
      'test-revealui-framework.ts',
      '+config.ts',
      'next.config.mjs',
    ],
  },
  ...sharedConfig,
]
