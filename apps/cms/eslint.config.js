import path from 'node:path'
import { fileURLToPath } from 'node:url'
import next from '@next/eslint-plugin-next'
import { baseConfig, createTypeCheckedConfig } from 'dev/eslint'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const nextFiles = [
  'src/**/*.{ts,tsx,js,jsx}',
  'app/**/*.{ts,tsx,js,jsx}',
  'pages/**/*.{ts,tsx,js,jsx}',
]

export default [
  ...baseConfig,
  createTypeCheckedConfig({ tsconfigRootDir: __dirname }),
  {
    ...next.configs['core-web-vitals'],
    files: nextFiles,
  },
]
