import js from '@eslint/js'
import tseslint from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import importX from 'eslint-plugin-import-x'
import globals from 'globals'

export const ignorePatterns = [
  '**/node_modules/**',
  '**/dist/**',
  '**/.next/**',
  '**/.turbo/**',
  '**/coverage/**',
  '**/build/**',
  '**/output/**',
  '**/public/**',
  '**/generated/**',
]

export const tsFiles = [
  'src/**/*.{ts,tsx,mts,cts}',
  'app/**/*.{ts,tsx,mts,cts}',
  '__tests__/**/*.{ts,tsx,mts,cts}',
  'tests/**/*.{ts,tsx,mts,cts}',
  '**/*.config.{ts,tsx,mts,cts}',
]

const tsRecommendedConfigs = tseslint.configs['flat/recommended']
const typeCheckedRules = tseslint.configs['flat/recommended-type-checked-only'][2].rules

export const baseConfig = [
  {
    ignores: ignorePatterns,
  },
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  js.configs.recommended,
  {
    ...tsRecommendedConfigs[0],
    files: tsFiles,
  },
  tsRecommendedConfigs[1],
  {
    ...tsRecommendedConfigs[2],
    files: tsFiles,
  },
  {
    files: tsFiles,
    plugins: {
      'import-x': importX,
    },
    settings: {
      'import-x/resolver': {
        typescript: true,
        node: true,
      },
    },
    rules: {
      'import-x/extensions': [
        'error',
        'always',
        {
          ignorePackages: true,
          checkTypeImports: true,
        },
      ],
    },
  },
]

export const createTypeCheckedConfig = ({
  tsconfigRootDir,
  tsconfigPath = './tsconfig.json',
  files = tsFiles,
  ignores = [],
} = {}) => {
  const defaultIgnores = [
    '**/*.test.*',
    '**/*.spec.*',
    '**/__tests__/**',
    '**/tests/**',
    '**/*.config.{ts,tsx,mts,cts}',
  ]

  return {
    files,
    ignores: [...defaultIgnores, ...ignores],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: tsconfigPath,
        tsconfigRootDir,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: typeCheckedRules,
  }
}

export default baseConfig
