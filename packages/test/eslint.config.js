import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { baseConfig, createTypeCheckedConfig, tsFiles } from 'dev/eslint'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const typeCheckedFiles = [...tsFiles, 'scripts/**/*.{ts,tsx,mts,cts}']

export default [
  ...baseConfig,
  createTypeCheckedConfig({
    tsconfigRootDir: __dirname,
    tsconfigPath: './tsconfig.eslint.json',
    files: typeCheckedFiles,
  }),
  {
    files: ['load-tests/**/*.js'],
    languageOptions: {
      globals: {
        __ENV: 'readonly',
        __VU: 'readonly',
        __ITER: 'readonly',
      },
    },
  },
]
