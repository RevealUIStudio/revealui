import sharedConfig from 'dev/eslint'
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
