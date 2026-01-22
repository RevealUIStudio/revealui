/**
 * Root ESLint Configuration for RevealUI Monorepo
 *
 * This config serves as the entry point for VS Code's ESLint extension.
 * It provides minimal TypeScript support and complements Biome for linting.
 *
 * Since this is a monorepo where Biome handles most linting and formatting,
 * ESLint is kept minimal to avoid conflicts and focus on essential rules.
 *
 * The config uses flat config format (ESLint 9+) and delegates to package-specific
 * configs for more advanced rules when available.
 */
export default [
  {
    ignores: [
      'node_modules/',
      'dist/',
      'build/',
      '.next/',
      '.turbo/',
      '.vite/',
      'coverage/',
      'apps/*/dist/',
      'apps/*/.next/',
      'apps/*/.turbo/',
      'packages/*/dist/',
      'packages/*/.next/',
      'packages/*/.turbo/',
      '**/*.min.js',
      '**/*.bundle.js',
      '**/scripts/**',
      '**/__tests__/**',
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*.spec.ts',
      '**/*.spec.tsx',
    ],
  },
  // Basic configuration for TypeScript files
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: '@typescript-eslint/parser',
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: true, // Enable project-based type checking when tsconfig.json is available
      },
    },
    plugins: {
      '@typescript-eslint': require('@typescript-eslint/eslint-plugin'),
    },
    rules: {
      // Disable React rules since we're not importing React plugin
      'react/jsx-uses-react': 'off',
      'react/react-in-jsx-scope': 'off',

      // Basic TypeScript rules (non-type-aware)
      '@typescript-eslint/no-explicit-any': 'warn',

      // Consistent import style
      '@typescript-eslint/consistent-type-imports': [
        'off', // Disabled to avoid conflicts with Biome
        {
          prefer: 'type-imports',
          fixStyle: 'separate-type-imports',
        },
      ],
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
]
