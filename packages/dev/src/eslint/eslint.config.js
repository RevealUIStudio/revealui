import tseslint from 'typescript-eslint'

/**
 * TypeScript-First ESLint Configuration
 *
 * This config uses type-aware linting rules that leverage TypeScript's type system.
 * It automatically finds tsconfig.json files in each package/app directory.
 *
 * Key features:
 * - Type-aware rules (no-unsafe-*) that catch type safety issues
 * - Uses TypeScript compiler for type checking, not just syntax
 * - Stricter rules enabled by default for better type safety
 * - Separate configs for type-aware (TypeScript source files) and non-type-aware (config files)
 */
export default [
  {
    ignores: [
      'node_modules/',
      'dist/',
      'build/',
      'env.d.ts',
      '.env',
      '.env.development.local',
      '.env.test.local',
      '.env.production.local',
      '.vite/',
      'framework/',
      '.next/',
    ],
  },
  // Base TypeScript ESLint config (syntax-only rules, applies to all files)
  ...tseslint.configs.recommended,
  {
    rules: {
      'react/jsx-uses-react': 'off',
      'react/react-in-jsx-scope': 'off',

      // TypeScript-First Rules (Syntax-only, no type information needed)
      // Ban explicit 'any' type (works without type information)
      '@typescript-eslint/no-explicit-any': 'error',

      // Prefer type-only imports when possible
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        {
          prefer: 'type-imports',
          fixStyle: 'separate-type-imports',
        },
      ],
    },
    settings: {
      react: {
        version: 'detect', // Automatically detect React version
      },
      'import/resolver': {
        node: {
          paths: ['src'], // Helps resolve imports using absolute paths
        },
      },
      tailwindcss: {
        config: '../tailwind/tailwind.config.js', // Custom Tailwind config
      },
    },
  },
  // Type-aware config (only for TypeScript source files included in tsconfig.json)
  // This uses TypeScript's type system to catch type safety issues
  // Note: Files must be included in tsconfig.json to be type-checked
  // If you get "TSConfig does not include this file" errors, add the file to your tsconfig.json "include" array
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: ['**/*.ts', '**/*.tsx'],
    ignores: [
      // Config files typically don't need type-aware linting
      '**/*.config.ts',
      '**/eslint.config.*',
      '**/vite.config.*',
      '**/next.config.*',
      '**/postcss.config.*',
      '**/tailwind.config.*',
      // Test files are excluded by default (add to tsconfig.json to enable type-checking)
      '**/__tests__/**',
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*.spec.ts',
      '**/*.spec.tsx',
      // Script files are utility scripts, exclude from type-aware linting
      '**/scripts/**',
    ],
    languageOptions: {
      ...config.languageOptions,
      // Automatically find tsconfig.json in the current working directory
      // This allows each package/app to use its own tsconfig.json
      parserOptions: {
        ...config.languageOptions?.parserOptions,
        // Use project: true to auto-detect tsconfig.json
        // Note: For better performance on large codebases, consider:
        // 1. Using ESLint's --cache flag
        // 2. Limiting type-aware rules to specific directories
        // 3. Using incremental builds with TypeScript project references
        project: true, // Auto-detect tsconfig.json
        tsconfigRootDir: process.cwd(), // Use the package/app's directory
      },
    },
    rules: {
      ...config.rules,
      // Type-safe rules (require type information):
      // Catch unsafe assignments that could lose type information
      '@typescript-eslint/no-unsafe-assignment': 'error',
      // Catch unsafe member access on 'any' types
      '@typescript-eslint/no-unsafe-member-access': 'error',
      // Catch unsafe function calls
      '@typescript-eslint/no-unsafe-call': 'error',
      // Catch unsafe return statements
      '@typescript-eslint/no-unsafe-return': 'error',
      // Catch unsafe argument passing
      '@typescript-eslint/no-unsafe-argument': 'error',

      // Additional type-aware rules for better safety:
      // Require explicit return types on exported functions
      '@typescript-eslint/explicit-module-boundary-types': 'warn',
    },
  })),
]
