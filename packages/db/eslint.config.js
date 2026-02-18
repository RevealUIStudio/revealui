import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { baseConfig, createTypeCheckedConfig } from 'dev/eslint'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default [
  ...baseConfig,
  createTypeCheckedConfig({ tsconfigRootDir: __dirname }),
  {
    rules: {
      'revealui/no-db-type-imports': 'off',
    },
  },
]
