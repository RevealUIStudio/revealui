/**
 * Shared Biome Configuration for RevealUI Framework
 *
 * This config provides formatting and linting rules aligned with project conventions:
 * - Single quotes for strings, double quotes for JSX attributes
 * - No semicolons (asNeeded)
 * - ES6 trailing commas
 * - 2 space indentation, 100 char line width
 * - Arrow functions always use parentheses
 * - Organize imports automatically
 *
 * Biome handles:
 * - Code formatting
 * - Most linting rules (style, correctness, performance)
 * - Import organization
 *
 * @type {import('@biomejs/biome').Config}
 */
export const biomeConfig = {
  $schema: 'https://biomejs.dev/schemas/2.3.11/schema.json',
  files: {
    includes: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.json'],
    ignore: [
      '**/dist',
      '**/node_modules',
      '**/.next',
      '**/build',
      '**/.cursor',
      '**/.turbo',
      '**/.vite',
      '**/coverage',
      '**/*.min.js',
      '**/*.bundle.js',
    ],
  },
  formatter: {
    enabled: true,
    indentStyle: 'space',
    indentWidth: 2,
    lineWidth: 100,
  },
  linter: {
    enabled: true,
    rules: {
      recommended: true,
      // Style rules aligned with project conventions
      style: {
        useForOf: 'error',
        useConst: 'error',
        useTemplate: 'error',
        useNamingConvention: {
          level: 'warn',
          options: {
            strictCase: false,
            conventions: [
              {
                selector: {
                  kind: 'variable',
                  modifiers: ['const'],
                  match: true,
                },
                formatters: ['PascalCase', 'camelCase', 'UPPER_CASE'],
              },
              {
                selector: {
                  kind: 'function',
                  match: true,
                },
                formatters: ['camelCase', 'PascalCase'],
              },
              {
                selector: {
                  kind: 'typeLike',
                  match: true,
                },
                formatters: ['PascalCase'],
              },
            ],
          },
        },
      },
      // Suspicious code patterns
      suspicious: {
        noExplicitAny: 'error',
        noArrayIndexKey: 'warn',
        noAssignInExpressions: 'error',
        noAsyncPromiseExecutor: 'error',
        noCatchAssign: 'error',
        noClassAssign: 'error',
        noCommentText: 'warn',
        noCompareNegZero: 'error',
        noControlCharactersInRegex: 'error',
        noDebugger: 'error',
        noDoubleEquals: 'error',
        noDuplicateCase: 'error',
        noDuplicateClassMembers: 'error',
        noDuplicateObjectKeys: 'error',
        noDuplicateParameters: 'error',
        noEmptyBlockStatements: 'warn',
        noFallthroughSwitchCase: 'error',
        noFunctionAssign: 'error',
        noGlobalObjectCalls: 'error',
        noImportAssign: 'error',
        noMisleadingCharacterClass: 'error',
        noMisleadingInstantiator: 'error',
        noPrototypeBuiltins: 'error',
        noRedeclare: 'error',
        noShadowRestrictedNames: 'error',
        noUnsafeFinally: 'error',
        noUnsafeOptionalChaining: 'error',
        noUnusedLabels: 'warn',
        noUnusedVariables: 'error',
        useGetterReturn: 'error',
        useValidTypeof: 'error',
      },
      // Correctness rules
      correctness: {
        noConstAssign: 'error',
        noConstantCondition: 'error',
        noConstructorReturn: 'error',
        noEmptyCharacterClassInRegex: 'error',
        noEmptyPattern: 'error',
        noGlobalAssign: 'error',
        noInvalidConstructorSuper: 'error',
        noInvalidNewBuiltin: 'error',
        noNonoctalDecimalEscape: 'error',
        noPrecisionLoss: 'error',
        noSelfAssign: 'error',
        noSetterReturn: 'error',
        noSwitchDeclarations: 'error',
        noUndeclaredVariables: 'error',
        noUnreachable: 'error',
        noUnreachableSuper: 'error',
        noUnsafeFinally: 'error',
        noUnsafeNegation: 'error',
        noUnusedPrivateClassMembers: 'warn',
        noUnusedVariables: 'error',
        useIsNan: 'error',
        useValidForDirection: 'error',
        useYield: 'error',
      },
      // Performance rules
      performance: {
        noAccumulatingSpread: 'warn',
        noDelete: 'error',
      },
      // Security rules
      security: {
        noDangerouslySetInnerHtml: 'warn',
        noGlobalEval: 'error',
      },
      // Complexity rules
      complexity: {
        noBannedTypes: {
          level: 'warn',
          options: {
            types: {
              String: {
                message: 'Use string instead of String',
                fix: 'string',
              },
              Boolean: {
                message: 'Use boolean instead of Boolean',
                fix: 'boolean',
              },
              Number: {
                message: 'Use number instead of Number',
                fix: 'number',
              },
            },
          },
        },
        noForEach: 'off', // Allow forEach for readability
        noUselessTypeConstraint: 'error',
        useArrowFunction: 'warn',
        useSimplifiedLogicExpression: 'warn',
      },
      // React rules
      a11y: {
        recommended: true,
      },
      // Import organization
      organizeImports: {
        enabled: true,
      },
    },
  },
  javascript: {
    formatter: {
      quoteStyle: 'single',
      jsxQuoteStyle: 'double',
      quoteProperties: 'asNeeded',
      trailingCommas: 'all',
      semicolons: 'asNeeded',
      arrowParentheses: 'always',
    },
    globals: ['console', 'process', '__dirname', '__filename', 'global', 'Buffer', 'NodeJS'],
  },
  overrides: [
    {
      // Config files can be more lenient
      includes: ['**/*.config.*', '**/vite.config.*'],
      linter: {
        rules: {
          suspicious: {
            noExplicitAny: 'warn',
          },
        },
      },
    },
    {
      // Test files can be more lenient
      includes: ['**/*.test.*', '**/*.spec.*', '**/__tests__/**'],
      linter: {
        rules: {
          suspicious: {
            noExplicitAny: 'warn',
          },
          correctness: {
            noUnusedVariables: 'warn',
          },
        },
      },
    },
  ],
  assist: {
    actions: {
      source: {
        organizeImports: 'on',
      },
    },
  },
}

export default biomeConfig
