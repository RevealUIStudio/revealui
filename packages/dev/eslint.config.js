import sharedConfig from './src/eslint/eslint.config.js'

export default [
  {
    ignores: ['**/dist/**', '**/node_modules/**'],
  },
  ...sharedConfig,
]
