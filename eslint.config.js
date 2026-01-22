import tseslint from 'typescript-eslint'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Monorepo ESLint Configuration
 *
 * This config provides centralized linting for the entire RevealUI monorepo.
 * It coordinates between packages and ensures consistent rules across the codebase.
 *
 * Structure:
 * - Root-level ignores for common files
 * - Package-specific configurations with appropriate tsconfig references
 * - Shared rules from the dev package
 */
export default [
  // Global ignores - apply to entire monorepo
  {
    ignores: [
      // Build outputs
      '**/dist/**',
      '**/build/**',
      '**/out/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/coverage/**',

      // Dependencies
      '**/node_modules/**',

      // Config files that shouldn't be linted
      '**/*.json',
      '**/*.md',
      '**/*.yml',
      '**/*.yaml',
      '**/*.toml',
      '**/tsconfig.json',
      '**/package.json',
      '**/vite.config.*',
      '**/postcss.config.*',
      '**/tailwind.config.*',

      // Test setup and fixtures
      '**/__tests__/fixtures/**',
      '**/test-data/**',

      // Generated files
      '**/generated/**',
      '**/*.generated.*',
    ],
  },

  // Base TypeScript ESLint config (syntax-only rules)
  ...tseslint.configs.recommended,

  // Core rules that apply to all TypeScript files
  {
    rules: {
      'react/jsx-uses-react': 'off',
      'react/react-in-jsx-scope': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
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
        version: 'detect',
      },
    },
  },

  // Package-specific configurations with proper tsconfig references
  {
    files: ['packages/auth/src/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        project: path.join(__dirname, 'packages/auth/tsconfig.json'),
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      // Auth package specific rules can go here
    },
  },

  {
    files: ['packages/core/src/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        project: path.join(__dirname, 'packages/core/tsconfig.json'),
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      // Core package specific rules can go here
    },
  },

  {
    files: ['packages/sync/src/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        project: path.join(__dirname, 'packages/sync/tsconfig.json'),
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      // Sync package specific rules can go here
    },
  },

  {
    files: ['packages/config/src/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        project: path.join(__dirname, 'packages/config/tsconfig.json'),
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      // Config package specific rules can go here
    },
  },

  {
    files: ['packages/db/src/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        project: path.join(__dirname, 'packages/db/tsconfig.json'),
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      // DB package specific rules can go here
    },
  },

  {
    files: ['packages/services/src/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        project: path.join(__dirname, 'packages/services/tsconfig.json'),
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      // Services package specific rules can go here
    },
  },

  {
    files: ['packages/ai/src/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        project: path.join(__dirname, 'packages/ai/tsconfig.json'),
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      // AI package specific rules can go here
    },
  },

  // Dashboard, landing, and other app packages
  {
    files: ['apps/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        project: (filePath) => {
          // Find the appropriate tsconfig for each app
          if (filePath.includes('apps/dashboard')) {
            return path.join(__dirname, 'apps/dashboard/tsconfig.json')
          }
          if (filePath.includes('apps/landing')) {
            return path.join(__dirname, 'apps/landing/tsconfig.json')
          }
          if (filePath.includes('apps/cms')) {
            return path.join(__dirname, 'apps/cms/tsconfig.json')
          }
          if (filePath.includes('apps/docs')) {
            return path.join(__dirname, 'apps/docs/tsconfig.json')
          }
          return path.join(__dirname, 'tsconfig.json')
        },
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      // App-specific rules
    },
  },

  // Test files - relax some rules and don't require type checking
  {
    files: ['**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}', '**/__tests__/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        project: false, // Disable type checking for test files
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
    },
  },

  // Configuration and build files - minimal rules
  {
    files: ['**/*.config.{ts,js}', '**/scripts/**/*.{ts,js}'],
    rules: {
      '@typescript-eslint/no-var-requires': 'off',
      'no-console': 'off',
    },
  },
]
