import sharedConfig from 'dev/eslint'
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
