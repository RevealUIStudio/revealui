import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { baseConfig, createTypeCheckedConfig } from 'dev/eslint'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const testFiles = ['src/**/__tests__/**/*.{ts,tsx}', 'src/**/*.test.{ts,tsx}']

export default [
  ...baseConfig,
  createTypeCheckedConfig({ tsconfigRootDir: __dirname }),
  {
    files: testFiles,
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
]
