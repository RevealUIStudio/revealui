import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { baseConfig, createTypeCheckedConfig } from 'dev/eslint'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const typeCheckedIgnores = [
  'src/plugin/**',
  'src/types/index.ts',
  'src/core/server/**',
  'src/core/utils/block-conversion.tsx',
]

export default [
  ...baseConfig,
  createTypeCheckedConfig({ tsconfigRootDir: __dirname, ignores: typeCheckedIgnores }),
]
