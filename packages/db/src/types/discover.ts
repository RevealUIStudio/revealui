#!/usr/bin/env tsx
/**
 * Table Discovery Utility
 *
 * Automatically discovers all pgTable exports from the schema files.
 * This eliminates the need to manually maintain a hardcoded table list.
 * Uses TypeScript Compiler API for robust, semantic parsing.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from '@revealui/utils/logger';
import * as ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Control verbose logging for build-time operations
const VERBOSE_LOGGING =
  process.env.DB_VERBOSE !== 'false' &&
  (process.env.NODE_ENV !== 'production' || process.env.CI !== 'true');

export interface DiscoveredTable {
  /** Variable name (camelCase) - e.g., 'users', 'siteCollaborators' */
  variableName: string;
  /** Database table name (snake_case) - e.g., 'users', 'site_collaborators' */
  tableName: string;
  /** Source file path relative to schema directory */
  sourceFile: string;
}

/**
 * Parse error with location information
 */
export interface ParseError {
  file: string;
  message: string;
  position?: { line: number; column: number };
  node?: string;
  context?: string;
}

/**
 * Result of table discovery with errors
 */
export interface DiscoveryResult {
  tables: DiscoveredTable[];
  errors: ParseError[];
}

/**
 * Parses a TypeScript source file using TypeScript Compiler API
 * @internal Exported for testing purposes
 */
export function parseSourceFile(filePath: string): ts.SourceFile {
  const content = readFileSync(filePath, 'utf-8');
  return ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true, // setParentNodes - needed for traversal
  );
}

/**
 * Extracts table name from pgTable call expression
 * Handles: pgTable('table_name', {...}) or pgTable("table_name", {...})
 * Uses AST-based extraction (no regex)
 * @internal Exported for testing purposes
 */
export function extractTableNameFromCall(
  callExpr: ts.CallExpression,
  errors?: ParseError[],
): string | null {
  // pgTable call should have at least one argument (the table name string)
  if (callExpr.arguments.length === 0) return null;

  const firstArg = callExpr.arguments[0];

  if (!firstArg) return null;

  // Check if first argument is a string literal
  if (ts.isStringLiteral(firstArg) || ts.isStringLiteralLike(firstArg)) {
    return firstArg.text;
  }

  // Handle simple template literals (no substitutions)
  // Table names shouldn't be dynamic, so we only support static templates
  if (ts.isNoSubstitutionTemplateLiteral(firstArg)) {
    // Extract text directly from AST node - no regex needed
    // getText() includes backticks, but text property gives us the raw text
    return firstArg.text;
  }

  // Reject template expressions with substitutions (dynamic table names not supported)
  if (ts.isTemplateExpression(firstArg)) {
    if (errors) {
      const sourceFile = firstArg.getSourceFile();
      const pos = sourceFile.getLineAndCharacterOfPosition(firstArg.getStart());
      errors.push({
        file: sourceFile.fileName,
        message:
          'Template expressions in table names are not supported  -  use a static string literal',
        position: { line: pos.line + 1, column: pos.character + 1 },
        node: ts.SyntaxKind[firstArg.kind],
      });
    }
    return null;
  }

  return null;
}

/**
 * Finds all pgTable calls in a source file and extracts table information
 * @internal Exported for testing purposes
 */
export function findTableExports(
  sourceFile: ts.SourceFile,
  filePath: string,
  errors?: ParseError[],
): DiscoveredTable[] {
  const tables: DiscoveredTable[] = [];
  // Always resolve to src/schema, regardless of whether running from src or dist
  const packageRoot = join(__dirname, '../..');
  const schemaDir = join(packageRoot, 'src/schema');
  const relativePath = filePath.replace(`${schemaDir}/`, '');

  // Traverse AST to find export const <name> = pgTable(...) patterns
  function visit(node: ts.Node) {
    // Look for VariableStatement with export modifier
    if (ts.isVariableStatement(node)) {
      // Check if it's exported (ExportKeyword) or declared (DeclareKeyword)
      // DeclareKeyword is included for completeness, though not currently used
      if (
        node.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.ExportKeyword) ||
        node.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.DeclareKeyword)
      ) {
        // Visit each variable declaration
        node.declarationList.declarations.forEach((decl) => {
          if (ts.isIdentifier(decl.name) && decl.initializer) {
            // Check if initializer is a call to pgTable
            if (ts.isCallExpression(decl.initializer)) {
              const callExpr = decl.initializer;
              // Check if the function being called is 'pgTable'
              if (ts.isIdentifier(callExpr.expression)) {
                if (callExpr.expression.text === 'pgTable') {
                  const variableName = decl.name.text;
                  const tableName = extractTableNameFromCall(callExpr, errors);

                  if (tableName) {
                    tables.push({
                      variableName,
                      tableName,
                      sourceFile: relativePath,
                    });
                  } else {
                    logger.warn(
                      `⚠️  Could not extract table name for ${variableName} in ${filePath}`,
                    );
                  }
                }
              }
            }
          }
        });
      }
    }

    // Continue traversing
    ts.forEachChild(node, visit);
  }

  // Start traversal from root
  ts.forEachChild(sourceFile, visit);

  return tables;
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
  };

  if (context) {
    error.context = context;
  }

  if (node) {
    const pos = sourceFile.getLineAndCharacterOfPosition(node.getStart());
    error.position = {
      line: pos.line + 1, // 1-indexed
      column: pos.character + 1, // 1-indexed
    };
    error.node = ts.SyntaxKind[node.kind];
  }

  return error;
}

/**
 * Discovers all pgTable exports from a single file using AST
 * @internal Exported for testing purposes
 */
export function discoverTablesInFile(filePath: string): {
  tables: DiscoveredTable[];
  errors: ParseError[];
} {
  try {
    const sourceFile = parseSourceFile(filePath);
    const tables: DiscoveredTable[] = [];
    const errors: ParseError[] = [];

    // findTableExports now propagates errors for unsupported patterns
    const foundTables = findTableExports(sourceFile, filePath, errors);
    tables.push(...foundTables);

    return { tables, errors };
  } catch (error) {
    return {
      tables: [],
      errors: [
        {
          file: filePath,
          message: `Failed to parse file: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
}

/**
 * Discovers all pgTable exports from the schema directory
 *
 * Scans all TypeScript files in packages/db/src/schema and extracts
 * all pgTable declarations.
 * Returns structured result with tables and errors.
 */
export function discoverTables(): DiscoveryResult {
  // Always resolve to src/schema, regardless of whether running from src or dist
  // __dirname could be either packages/db/src/types or packages/db/dist/types
  const packageRoot = join(__dirname, '../..');
  const schemaDir = join(packageRoot, 'src/schema');
  const tables: DiscoveredTable[] = [];
  const errors: ParseError[] = [];

  // Read all files in schema directory
  const files = readdirSync(schemaDir)
    .filter((file) => file.endsWith('.ts') && file !== 'index.ts' && file !== 'query.ts')
    .map((file) => join(schemaDir, file));

  // Also check index.ts for direct exports
  const indexPath = join(schemaDir, 'index.ts');
  if (statSync(indexPath).isFile()) {
    // index.ts re-exports, so we check the actual source files
    // But we still need to read it to understand the export structure
  }

  // Discover tables in each file
  for (const file of files) {
    try {
      const result = discoverTablesInFile(file);
      tables.push(...result.tables);
      errors.push(...result.errors);
    } catch (error) {
      errors.push({
        file,
        message: `Failed to read file: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  // Sort by variable name for consistency
  tables.sort((a, b) => a.variableName.localeCompare(b.variableName));

  return { tables, errors };
}

/**
 * Validates discovered tables
 */
export function validateTables(tables: DiscoveredTable[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const variableNames = new Set<string>();
  const tableNames = new Set<string>();

  for (const table of tables) {
    // Check for duplicate variable names
    if (variableNames.has(table.variableName)) {
      errors.push(`Duplicate variable name: ${table.variableName}`);
    }
    variableNames.add(table.variableName);

    // Check for duplicate table names
    if (tableNames.has(table.tableName)) {
      errors.push(`Duplicate table name: ${table.tableName}`);
    }
    tableNames.add(table.tableName);

    // Validate table name format (should be snake_case)
    if (!/^[a-z][a-z0-9_]*$/.test(table.tableName)) {
      errors.push(`Invalid table name format: ${table.tableName} (should be snake_case)`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// CLI interface for testing
if (import.meta.url === `file://${process.argv[1]}`) {
  const result = discoverTables();
  const { tables, errors } = result;
  const validation = validateTables(tables);

  if (VERBOSE_LOGGING) {
    logger.info(`\n📊 Discovered ${tables.length} tables:\n`);
    for (const table of tables) {
      logger.info(`  ${table.variableName.padEnd(25)} → ${table.tableName} (${table.sourceFile})`);
    }

    // Log discovery errors
    if (errors.length > 0) {
      logger.warn('\n⚠️  Discovery warnings/errors:');
      for (const error of errors) {
        const location = error.position
          ? `${error.file}:${error.position.line}:${error.position.column}`
          : error.file;
        logger.warn(
          `  - ${location}: ${error.message}${error.context ? ` (${error.context})` : ''}`,
        );
      }
    }
  }

  if (!validation.valid) {
    logger.error('\n❌ Validation errors:');
    for (const error of validation.errors) {
      logger.error(`  - ${error}`);
    }
    process.exit(1);
  } else if (VERBOSE_LOGGING) {
    // Success logging removed for production cleanliness
    // logger.info('\n✅ All tables validated successfully')
  }
}
