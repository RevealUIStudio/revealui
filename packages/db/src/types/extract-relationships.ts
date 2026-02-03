#!/usr/bin/env tsx
/**
 * Relationship Extraction Utility
 *
 * Automatically extracts relationships from Drizzle relations() calls.
 * This eliminates the need to manually maintain hardcoded relationships.
 * Uses TypeScript Compiler API for robust, semantic parsing.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { logger } from '@revealui/core/observability/logger'
import * as ts from 'typescript'
import type { DiscoveredTable } from './discover.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export interface ExtractedRelationship {
  foreignKeyName: string
  columns: string[]
  isOneToOne: boolean
  referencedRelation: string
  referencedColumns: string[]
}

export interface TableRelationships {
  tableVariableName: string
  relationships: ExtractedRelationship[]
}

/**
 * Parse error with location information
 */
export interface ParseError {
  file: string
  message: string
  position?: { line: number; column: number }
  node?: string
  context?: string
}

/**
 * Result of relationship extraction with errors
 */
export interface ExtractionResult {
  relationships: TableRelationships[]
  errors: ParseError[]
}

/**
 * Converts camelCase to snake_case
 * @internal Exported for testing purposes
 */
export function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
}

/**
 * Generates foreign key name from relationship
 * Format: <table>_<column>_<referenced_table>_<referenced_column>_fk
 * @internal Exported for testing purposes
 */
export function generateForeignKeyName(
  tableName: string,
  column: string,
  referencedTable: string,
  referencedColumn: string,
): string {
  return `${tableName}_${column}_${referencedTable}_${referencedColumn}_fk`
}

/**
 * Converts table variable name to database table name
 * @internal Exported for testing purposes
 */
export function getTableName(variableName: string, tables: DiscoveredTable[]): string {
  const table = tables.find((t) => t.variableName === variableName)
  return table ? table.tableName : camelToSnake(variableName)
}

/**
 * Creates a ParseError with position information from source file
 * @internal Exported for testing purposes
 */
export function createParseError(
  sourceFile: ts.SourceFile,
  node: ts.Node | null,
  message: string,
  context?: string,
): ParseError {
  const error: ParseError = {
    file: sourceFile.fileName,
    message,
  }

  if (context) {
    error.context = context
  }

  if (node) {
    const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart())
    error.position = {
      line: pos.line + 1, // 1-indexed
      column: pos.character + 1, // 1-indexed
    }
    error.node = ts.SyntaxKind[node.kind]
  }

  return error
}

/**
 * Parses a TypeScript source file using TypeScript Compiler API
 * @internal Exported for testing purposes
 */
export function parseSourceFile(filePath: string): ts.SourceFile {
  const content = readFileSync(filePath, 'utf-8')
  return ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true, // setParentNodes - needed for traversal
  )
}

/**
 * Resolves column name from a TypeScript property access expression
 * Handles: sessions.userId -> userId -> user_id
 * @internal Exported for testing purposes
 */
export function resolveColumnName(expr: ts.Expression, expectedTableVar: string): string | null {
  // Check if it's a property access expression like sessions.userId
  if (ts.isPropertyAccessExpression(expr)) {
    // Check if the object is the expected table variable
    if (ts.isIdentifier(expr.expression)) {
      const tableVar = expr.expression.text
      if (tableVar === expectedTableVar) {
        // Extract the property name (column name in camelCase)
        const columnVar = expr.name.text
        // Convert camelCase to snake_case for database column name
        return camelToSnake(columnVar)
      }
    }
  }

  return null
}

/**
 * Extracts column names from an array literal expression
 * Handles: [sessions.userId, sessions.otherColumn]
 * Detects and warns about unsupported patterns (spreads, nested access, etc.)
 * @internal Exported for testing purposes
 */
export function extractArrayElements(
  arrayExpr: ts.ArrayLiteralExpression,
  expectedTableVar: string,
  sourceFile: ts.SourceFile,
  context: string,
  errors: ParseError[],
): string[] {
  const columns: string[] = []

  for (const element of arrayExpr.elements) {
    // Detect unsupported spread elements
    if (ts.isSpreadElement(element)) {
      errors.push(
        createParseError(sourceFile, element, `Spread operator in array is not supported`, context),
      )
      continue
    }

    // Detect nested property access (e.g., sessions.user.profile)
    if (ts.isPropertyAccessExpression(element)) {
      let depth = 0
      let current: ts.Expression = element
      while (ts.isPropertyAccessExpression(current)) {
        depth++
        current = current.expression
      }

      if (depth > 1) {
        errors.push(
          createParseError(
            sourceFile,
            element,
            `Nested property access (depth ${depth}) is not supported - only direct table.column access`,
            context,
          ),
        )
        continue
      }
    }

    // Detect computed property access (e.g., sessions[someVar])
    if (ts.isElementAccessExpression(element)) {
      errors.push(
        createParseError(
          sourceFile,
          element,
          `Computed property access is not supported - only direct table.column access`,
          context,
        ),
      )
      continue
    }

    const columnName = resolveColumnName(element, expectedTableVar)
    if (columnName) {
      columns.push(columnName)
    } else if (!ts.isIdentifier(element)) {
      // Not a simple property access - warn
      errors.push(
        createParseError(
          sourceFile,
          element,
          `Unsupported expression type in array - only table.column references are supported`,
          context,
        ),
      )
    }
  }

  return columns
}

/**
 * Finds all relations() calls in a single AST traversal
 * Returns a map of table variable name to relations() call expression
 *
 * Performance: O(M) where M = AST nodes (single pass)
 * @internal Exported for testing purposes
 */
export function findAllRelationsCalls(sourceFile: ts.SourceFile): Map<string, ts.CallExpression> {
  const results = new Map<string, ts.CallExpression>()

  function visit(node: ts.Node) {
    // Look for VariableStatement with export modifier
    if (ts.isVariableStatement(node)) {
      if (node.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.ExportKeyword)) {
        node.declarationList.declarations.forEach((decl) => {
          if (ts.isIdentifier(decl.name) && decl.initializer) {
            // Check if initializer is a call to relations()
            if (ts.isCallExpression(decl.initializer)) {
              const callExpr = decl.initializer

              // Check if the function being called is 'relations'
              if (ts.isIdentifier(callExpr.expression)) {
                if (callExpr.expression.text === 'relations') {
                  // Extract table variable name from first argument
                  const firstArg = callExpr.arguments[0]
                  if (firstArg && ts.isIdentifier(firstArg)) {
                    const tableVar = firstArg.text
                    results.set(tableVar, callExpr)
                  }
                }
              }
            }
          }
        })
      }
    }

    ts.forEachChild(node, visit)
  }

  ts.forEachChild(sourceFile, visit)

  return results
}

/**
 * Extracts the object literal from the arrow function in relations() call
 * Handles: relations(table, ({ one, many }) => ({ ... }))
 * @internal Exported for testing purposes
 */
export function extractRelationsObject(
  relationsCall: ts.CallExpression,
): ts.ObjectLiteralExpression | null {
  // relations() call should have a second argument (the arrow function)
  if (relationsCall.arguments.length < 2) return null

  const secondArg = relationsCall.arguments[1]
  if (!secondArg) return null

  // Check if second argument is an arrow function
  if (ts.isArrowFunction(secondArg)) {
    // Get the body - should be an object literal
    if (ts.isObjectLiteralExpression(secondArg.body)) {
      return secondArg.body
    }

    // Handle parentheses around object literal: ({ ... })
    if (ts.isParenthesizedExpression(secondArg.body)) {
      const expr = secondArg.body.expression
      if (ts.isObjectLiteralExpression(expr)) {
        return expr
      }
    }
  }

  return null
}

/**
 * Parses a single one() relationship from a property assignment
 * Handles: relationName: one(referencedTable, { fields: [...], references: [...] })
 * Detects unsupported patterns (computed properties, spreads, etc.)
 * @internal Exported for testing purposes
 */
export function parseOneRelationship(
  prop: ts.PropertyAssignment,
  sourceTable: string,
  tables: DiscoveredTable[],
  sourceFile: ts.SourceFile,
  errors: ParseError[],
): ExtractedRelationship | null {
  // Detect computed property names (not supported)
  if (ts.isComputedPropertyName(prop.name)) {
    errors.push(
      createParseError(
        sourceFile,
        prop.name,
        `Computed property name is not supported - only literal property names are supported`,
        `Table: ${sourceTable}`,
      ),
    )
    return null
  }

  // Check if the value is a call to one()
  if (!ts.isCallExpression(prop.initializer)) return null

  const callExpr = prop.initializer

  // Check if the function being called is 'one'
  if (!ts.isIdentifier(callExpr.expression)) return null
  if (callExpr.expression.text !== 'one') return null

  const relationName = ts.isIdentifier(prop.name) ? prop.name.text : 'unknown'

  // one() call should have two arguments: (referencedTable, { fields, references })
  if (callExpr.arguments.length < 2) return null

  // First argument should be the referenced table variable
  const referencedTableArg = callExpr.arguments[0]
  if (!(referencedTableArg && ts.isIdentifier(referencedTableArg))) return null
  const referencedTableVar = referencedTableArg.text

  // Second argument should be an object literal with fields and references
  const configArg = callExpr.arguments[1]
  if (!(configArg && ts.isObjectLiteralExpression(configArg))) return null

  // Extract fields array
  let fieldsArray: ts.ArrayLiteralExpression | null = null
  let referencesArray: ts.ArrayLiteralExpression | null = null

  for (const prop of configArg.properties) {
    if (ts.isPropertyAssignment(prop)) {
      if (ts.isIdentifier(prop.name)) {
        if (prop.name.text === 'fields' && ts.isArrayLiteralExpression(prop.initializer)) {
          fieldsArray = prop.initializer
        } else if (
          prop.name.text === 'references' &&
          ts.isArrayLiteralExpression(prop.initializer)
        ) {
          referencesArray = prop.initializer
        }
      }
    }
  }

  if (!(fieldsArray && referencesArray)) return null

  // Extract column names from arrays with error tracking
  const fieldsContext = `Table: ${sourceTable}, Relation: ${relationName}, fields`
  const referencesContext = `Table: ${sourceTable}, Relation: ${relationName}, references`
  const fieldColumns = extractArrayElements(
    fieldsArray,
    sourceTable,
    sourceFile,
    fieldsContext,
    errors,
  )
  const refColumns = extractArrayElements(
    referencesArray,
    referencedTableVar,
    sourceFile,
    referencesContext,
    errors,
  )

  if (fieldColumns.length === 0 || refColumns.length === 0) return null

  // Build relationship object
  const sourceTableName = getTableName(sourceTable, tables)
  const referencedTableName = getTableName(referencedTableVar, tables)

  const firstFieldColumn = fieldColumns[0]
  const firstRefColumn = refColumns[0]
  if (!(firstFieldColumn && firstRefColumn)) return null

  return {
    foreignKeyName: generateForeignKeyName(
      sourceTableName,
      firstFieldColumn,
      referencedTableName,
      firstRefColumn,
    ),
    columns: fieldColumns,
    isOneToOne: true, // one() = isOneToOne: true
    referencedRelation: referencedTableName,
    referencedColumns: refColumns,
  }
}

/**
 * Extracts all one() relationships from a relations object
 * Detects unsupported patterns and collects errors
 * @internal Exported for testing purposes
 */
export function extractOneRelationships(
  relationsObj: ts.ObjectLiteralExpression,
  sourceTable: string,
  tables: DiscoveredTable[],
  sourceFile: ts.SourceFile,
  errors: ParseError[],
): ExtractedRelationship[] {
  const relationships: ExtractedRelationship[] = []

  // Iterate through properties in the relations object
  for (const prop of relationsObj.properties) {
    if (ts.isPropertyAssignment(prop)) {
      const relationship = parseOneRelationship(prop, sourceTable, tables, sourceFile, errors)
      if (relationship) {
        relationships.push(relationship)
      }
    } else {
      // Shorthand property or method signature - warn
      errors.push(
        createParseError(
          sourceFile,
          prop,
          `Only property assignments are supported in relations object - shorthand or method signatures are not supported`,
          `Table: ${sourceTable}`,
        ),
      )
    }
  }

  return relationships
}

/**
 * Validates extracted relationships against discovered tables
 * @internal Exported for testing purposes
 */
export function validateRelationships(
  relationships: TableRelationships[],
  tables: DiscoveredTable[],
): ParseError[] {
  const errors: ParseError[] = []
  const tableNameMap = new Map<string, string>() // variableName -> tableName
  for (const table of tables) {
    tableNameMap.set(table.variableName, table.tableName)
  }

  const foreignKeyNames = new Set<string>()

  for (const tableRel of relationships) {
    for (const rel of tableRel.relationships) {
      // Validate referenced table exists
      const referencedTableExists = Array.from(tableNameMap.values()).includes(
        rel.referencedRelation,
      )
      if (!referencedTableExists) {
        errors.push({
          file: 'core/index.ts', // Relationships come from core/index.ts
          message: `Referenced table '${rel.referencedRelation}' does not exist`,
          context: `Table: ${tableRel.tableVariableName}, FK: ${rel.foreignKeyName}`,
        })
      }

      // Validate foreign key name uniqueness
      if (foreignKeyNames.has(rel.foreignKeyName)) {
        errors.push({
          file: 'core/index.ts',
          message: `Duplicate foreign key name: ${rel.foreignKeyName}`,
          context: `Table: ${tableRel.tableVariableName}`,
        })
      }
      foreignKeyNames.add(rel.foreignKeyName)

      // Validate columns are not empty
      if (rel.columns.length === 0) {
        errors.push({
          file: 'core/index.ts',
          message: `Empty columns array in relationship`,
          context: `Table: ${tableRel.tableVariableName}, FK: ${rel.foreignKeyName}`,
        })
      }

      // Validate referenced columns are not empty
      if (rel.referencedColumns.length === 0) {
        errors.push({
          file: 'core/index.ts',
          message: `Empty referencedColumns array in relationship`,
          context: `Table: ${tableRel.tableVariableName}, FK: ${rel.foreignKeyName}`,
        })
      }

      // Validate column count matches
      if (rel.columns.length !== rel.referencedColumns.length) {
        errors.push({
          file: 'core/index.ts',
          message: `Column count mismatch: ${rel.columns.length} columns vs ${rel.referencedColumns.length} referenced columns`,
          context: `Table: ${tableRel.tableVariableName}, FK: ${rel.foreignKeyName}`,
        })
      }
    }
  }

  return errors
}

/**
 * Extracts all relationships from core/index.ts using AST
 *
 * Performance: Single AST traversal (O(M)) instead of N traversals (O(N×M))
 * Returns structured result with relationships and errors
 */
export function extractRelationships(tables: DiscoveredTable[]): ExtractionResult {
  // Always resolve to src/schema/index.ts, regardless of whether running from src or dist
  const packageRoot = join(__dirname, '../..')
  const coreIndexPath = join(packageRoot, 'src/schema/index.ts')
  const errors: ParseError[] = []
  const results: TableRelationships[] = []

  try {
    const sourceFile = parseSourceFile(coreIndexPath)

    // Single-pass extraction: find all relations() calls in one AST traversal
    const relationsCallsMap = findAllRelationsCalls(sourceFile)

    // Find all table variable names from tables list
    const tableVars = tables.map((t) => t.variableName)

    // Extract relationships from cached relations() calls
    for (const tableVar of tableVars) {
      const relationsCall = relationsCallsMap.get(tableVar)

      if (relationsCall) {
        const relationsObj = extractRelationsObject(relationsCall)

        if (relationsObj) {
          const relationships = extractOneRelationships(
            relationsObj,
            tableVar,
            tables,
            sourceFile,
            errors,
          )

          // Always create an entry, even if empty (for tables with no relationships)
          results.push({
            tableVariableName: tableVar,
            relationships,
          })
        } else {
          // No relations object found - warn but don't fail
          errors.push(
            createParseError(
              sourceFile,
              relationsCall,
              `No relations object found for table ${tableVar}`,
              `Table: ${tableVar}`,
            ),
          )
          results.push({
            tableVariableName: tableVar,
            relationships: [],
          })
        }
      } else {
        // No relations() call found - not an error, just missing (some tables have no relations)
        // Don't add error, just create empty entry
        results.push({
          tableVariableName: tableVar,
          relationships: [],
        })
      }
    }

    // Note: We don't process many() relationships because:
    // - many() relationships don't create FKs on the source table
    // - They indicate the OTHER table has a FK pointing back
    // - The relationship entry should only be on the table that HAS the FK
    // - That relationship is already extracted from the one() call on the other table

    // Validate extracted relationships
    const validationErrors = validateRelationships(results, tables)
    errors.push(...validationErrors)

    return { relationships: results, errors }
  } catch (error) {
    // Critical error - file couldn't be parsed at all
    errors.push({
      file: coreIndexPath,
      message: `Failed to parse source file: ${error instanceof Error ? error.message : String(error)}`,
    })

    // Return empty results for all tables on critical error
    return {
      relationships: tables.map((t) => ({
        tableVariableName: t.variableName,
        relationships: [],
      })),
      errors,
    }
  }
}

// CLI interface for testing
if (import.meta.url === `file://${process.argv[1]}`) {
  void import('./discover.js').then(({ discoverTables }) => {
    const discoveryResult = discoverTables()
    const { tables } = discoveryResult
    const extractionResult = extractRelationships(tables)
    const { relationships } = extractionResult

    logger.info(`\n📊 Extracted relationships:\n`)
    for (const tableRel of relationships) {
      logger.info(`  ${tableRel.tableVariableName}:`)
      for (const rel of tableRel.relationships) {
        logger.info(
          `    - ${rel.foreignKeyName} (${rel.columns.join(', ')} → ${rel.referencedRelation}.${rel.referencedColumns.join(', ')}) [${rel.isOneToOne ? '1:1' : '1:N'}]`,
        )
      }
    }

    // Log errors if any
    if (extractionResult.errors.length > 0) {
      logger.warn('\n⚠️  Extraction errors:')
      for (const error of extractionResult.errors) {
        const location = error.position
          ? `${error.file}:${error.position.line}:${error.position.column}`
          : error.file
        logger.warn(
          `  - ${location}: ${error.message}${error.context ? ` (${error.context})` : ''}`,
        )
      }
    }
  })
}
