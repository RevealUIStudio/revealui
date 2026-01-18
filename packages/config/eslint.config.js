import sharedConfig from 'dev/eslint'

export default [
  {
    ignores: ['**/dist/**', '**/node_modules/**'],
  },
  ...sharedConfig,
]
