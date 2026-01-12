import sharedConfig from '../../packages/dev/src/eslint/eslint.config.js'
export default [
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.turbo/**',
      '**/public/**',
      '**/.next/**',
      'next-env.d.ts',
      '**/next-env.d.ts',
    ],
  },
  ...sharedConfig,
]
