/**
 * ESLint Rule: no-db-type-imports
 *
 * Prevents importing types directly from @revealui/db/schema.
 * Enforces using auto-generated types from @revealui/contracts/generated instead.
 *
 * ❌ Disallowed:
 *   import type { User } from '@revealui/db/schema'
 *   import { type Session } from '@revealui/db/schema'
 *   const user: typeof users.$inferSelect = ...
 *
 * ✅ Allowed:
 *   import type { UsersRow, SessionsRow } from '@revealui/contracts/generated'
 *   import type { Database } from '@revealui/db/client'  // Infrastructure type
 *   import { users, sessions } from '@revealui/db/schema'  // Schema objects for queries
 *   import { eq, and } from '@revealui/db/schema'  // Query operators
 */

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow importing types from @revealui/db/schema',
      category: 'Best Practices',
      recommended: true,
    },
    fixable: null,
    schema: [],
    messages: {
      noDbTypeImport:
        'Do not import types from "@revealui/db/schema". Use "@revealui/contracts/generated" instead. ' +
        'For example, use "UsersRow" instead of "User" or "typeof users.$inferSelect".',
    },
  },

  create(context) {
    return {
      // Check ImportDeclaration nodes
      // biome-ignore lint/style/useNamingConvention: ESLint visitor names must match AST node types
      ImportDeclaration(node) {
        // Only check imports from @revealui/db/schema
        if (node.source.value !== '@revealui/db/schema') {
          return
        }

        // Check if this is a type-only import
        if (node.importKind === 'type') {
          context.report({
            node,
            messageId: 'noDbTypeImport',
          })
          return
        }

        // Check for inline type imports (import { type User } from '...')
        const hasInlineTypeImport = node.specifiers.some(
          (specifier) => specifier.type === 'ImportSpecifier' && specifier.importKind === 'type',
        )

        if (hasInlineTypeImport) {
          context.report({
            node,
            messageId: 'noDbTypeImport',
          })
        }
      },

      // Check for typeof expressions like: typeof users.$inferSelect
      // biome-ignore lint/style/useNamingConvention: ESLint visitor names must match AST node types
      TSTypeQuery(node) {
        // Check if it's a member expression (e.g., users.$inferSelect)
        if (
          node.exprName?.type === 'TSQualifiedName' &&
          (node.exprName.right?.name === '$inferSelect' ||
            node.exprName.right?.name === '$inferInsert')
        ) {
          context.report({
            node,
            messageId: 'noDbTypeImport',
          })
        }
      },
    }
  },
}
