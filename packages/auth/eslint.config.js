import sharedConfig from 'dev/eslint'

export default [
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/tests/**', // Test setup files not in tsconfig
    ],
  },
  ...sharedConfig,
]
