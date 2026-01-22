import tseslint from 'typescript-eslint'

/**
 * TypeScript-First ESLint Configuration
 *
 * This config complements Biome by focusing on type-aware linting rules that require
 * TypeScript's type system. Biome handles formatting and most linting rules.
 *
 * Strategy:
 * - Biome: Formatting, style rules, correctness checks, performance, security
 * - ESLint: Type-aware TypeScript rules (requires type information from TS compiler)
 *
 * Key features:
 * - Type-aware rules (no-unsafe-*) that catch type safety issues
 * - Uses TypeScript compiler for type checking, not just syntax
 * - Stricter rules enabled by default for better type safety
 * - Separate configs for type-aware (TypeScript source files) and non-type-aware (config files)
 *
 * Note: Most formatting and style rules are handled by Biome. ESLint focuses on
 * type safety checks that require TypeScript's type information.
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
  // Note: Most style/formatting rules are handled by Biome
  ...tseslint.configs.recommended,
  {
    rules: {
      'react/jsx-uses-react': 'off',
      'react/react-in-jsx-scope': 'off',

      // TypeScript-First Rules (Syntax-only, no type information needed)
      // Note: no-explicit-any is handled by ESLint only (removed from Biome to avoid duplication)
      '@typescript-eslint/no-explicit-any': 'error',

      // Prefer type-only imports when possible
      // This complements Biome's organizeImports
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
        // Use explicit tsconfig.json path for monorepo packages
        // This avoids conflicts when packages import from each other
        project: './tsconfig.json', // Explicit path relative to package root
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
