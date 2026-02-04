/**
 * Import Generator Module
 *
 * Generates and parses TypeScript import statements for database types.
 * Extracted from copy-generated-types.ts for better modularity.
 *
 * @dependencies
 * - typescript - TypeScript Compiler API for AST parsing
 * - scripts/lib/generators/types/table-discovery.js - Table mapping types
 *
 * @example
 * ```typescript
 * import { generateNeonImports, parseImports } from './import-generator.js'
 *
 * const imports = generateNeonImports(tableMapping)
 * const parsed = parseImports(sourceCode)
 * ```
 */

import * as ts from 'typescript'
import type { TableMapping } from './table-discovery.js'

// =============================================================================
// Types
// =============================================================================

export interface ParsedImport {
  tables: string[]
  path: string
}

// =============================================================================
// Import Generation
// =============================================================================

/**
 * Generates import statements for neon.ts based on discovered table mappings
 *
 * Creates properly formatted import blocks with sub-module paths.
 * Single-table modules get single-line imports, multi-table modules get multi-line.
 *
 * @param tableMapping - Tables grouped by sub-module name
 * @returns Formatted import block with header comment
 *
 * @example
 * ```typescript
 * const mapping = { agents: ['agents'], users: ['users', 'profiles'] }
 * const imports = generateNeonImports(mapping)
 * // Returns:
 * // import { agents } from '@revealui/db/schema/agents'
 * // import {
 * //   users,
 * //   profiles,
 * // } from '@revealui/db/schema/users'
 * ```
 */
export function generateNeonImports(tableMapping: TableMapping): string {
  const imports: string[] = []

  // Get sorted sub-module names for deterministic ordering
  const subModules = Object.keys(tableMapping)
    .filter((subModule) => tableMapping[subModule].length > 0)
    .sort()

  // Generate imports in sorted order
  for (const subModulePath of subModules) {
    const tables = tableMapping[subModulePath]

    if (tables.length === 1) {
      // Single-line import for single table
      imports.push(`import { ${tables[0]} } from '@revealui/db/schema/${subModulePath}'`)
    } else {
      // Multi-line import for multiple tables
      const tablesList = tables.map((t) => `  ${t}`).join(',\n')
      imports.push(`import {\n${tablesList},\n} from '@revealui/db/schema/${subModulePath}'`)
    }
  }

  return `// Import table definitions from db package sub-modules
// TypeScript with node16 module resolution requires explicit sub-module exports
// This import block is automatically generated based on actual table exports
${imports.join('\n')}`
}

// =============================================================================
// Import Parsing
// =============================================================================

/**
 * Parses import statements from TypeScript source content
 *
 * Uses TypeScript Compiler API to robustly parse import declarations.
 * Only extracts imports from @revealui/db/schema/* paths.
 *
 * @param content - TypeScript source code
 * @returns Array of parsed imports with tables and paths
 *
 * @example
 * ```typescript
 * const code = `import { users, posts } from '@revealui/db/schema/users'`
 * const imports = parseImports(code)
 * // [{ tables: ['users', 'posts'], path: '@revealui/db/schema/users' }]
 * ```
 */
export function parseImports(content: string): ParsedImport[] {
  const sourceFile = ts.createSourceFile('temp.ts', content, ts.ScriptTarget.Latest, true)

  const imports: ParsedImport[] = []

  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node)) {
      const importPath = node.moduleSpecifier
      if (ts.isStringLiteral(importPath)) {
        const path = importPath.text

        // Only process imports from @revealui/db/schema/*
        if (path.startsWith('@revealui/db/schema/')) {
          const tables: string[] = []

          if (node.importClause) {
            // Handle named imports: import { table1, table2 } from ...
            if (node.importClause.namedBindings) {
              if (ts.isNamedImports(node.importClause.namedBindings)) {
                for (const element of node.importClause.namedBindings.elements) {
                  const name = element.name.text
                  tables.push(name)
                }
              }
            }
          }

          if (tables.length > 0) {
            imports.push({ tables, path })
          }
        }
      }
    }

    ts.forEachChild(node, visit)
  }

  ts.forEachChild(sourceFile, visit)
  return imports
}

/**
 * Format import statement for display
 *
 * @param imp - Parsed import
 * @returns Formatted string
 */
export function formatImport(imp: ParsedImport): string {
  if (imp.tables.length === 1) {
    return `import { ${imp.tables[0]} } from '${imp.path}'`
  } else {
    const tablesList = imp.tables.join(', ')
    return `import { ${tablesList} } from '${imp.path}'`
  }
}

/**
 * Get all imported table names from parsed imports
 *
 * @param imports - Array of parsed imports
 * @returns Flat array of all table names
 */
export function getAllImportedTables(imports: ParsedImport[]): string[] {
  return imports.flatMap((imp) => imp.tables)
}

/**
 * Find import containing a specific table
 *
 * @param imports - Array of parsed imports
 * @param tableName - Table name to find
 * @returns Parsed import containing the table, or undefined
 */
export function findImportForTable(
  imports: ParsedImport[],
  tableName: string,
): ParsedImport | undefined {
  return imports.find((imp) => imp.tables.includes(tableName))
}
