/**
 * Type Transformer Module
 *
 * Transforms and validates generated type files.
 * Handles import replacement and file copying with validation.
 *
 * Extracted from copy-generated-types.ts for better modularity.
 *
 * @dependencies
 * - node:fs - Synchronous file system operations (existsSync, mkdirSync, readFileSync, writeFileSync)
 * - node:path - Path utilities (dirname)
 * - scripts/lib/index.js - Logger utilities
 * - scripts/lib/generators/types/table-discovery.js - Table discovery and validation
 * - scripts/lib/generators/types/import-generator.js - Import statement generation and parsing
 *
 * @example
 * ```typescript
 * import { copyFileWithTransform, validateTransformation } from './type-transformer.js'
 *
 * await copyFileWithTransform(source, dest, 'admin types')
 * ```
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { ErrorCode, ScriptError } from '../../errors.js';
import { createLogger } from '../../index.js';
import {
  generateNeonImports,
  getAllImportedTables,
  type ParsedImport,
  parseImports,
} from './import-generator.js';
import {
  discoverTableMappings,
  type TableMapping,
  validateTableMapping,
} from './table-discovery.js';

const logger = createLogger({ prefix: 'TypeTransformer' });

// =============================================================================
// Types
// =============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface TransformOptions {
  /** Whether to transform imports for neon.ts */
  transformImports?: boolean;
  /** Whether to validate transformation */
  validate?: boolean;
  /** Project root directory */
  rootDir?: string;
}

// =============================================================================
// File Transformation
// =============================================================================

/**
 * Copy file with optional import transformation
 *
 * @param source - Source file path
 * @param dest - Destination file path
 * @param description - Description for logging
 * @param options - Transform options
 *
 * @example
 * ```typescript
 * copyFileWithTransform(
 *   'packages/db/src/types/database.ts',
 *   'packages/schema/src/generated/types/neon.ts',
 *   'Neon types',
 *   { transformImports: true }
 * )
 * ```
 */
export function copyFileWithTransform(
  source: string,
  dest: string,
  description: string,
  options: TransformOptions = {},
): void {
  const { transformImports = false, validate = true, rootDir = process.cwd() } = options;

  try {
    // Validate source file exists
    if (!existsSync(source)) {
      logger.warning(`Source file not found: ${source.replace(rootDir, '.')}`);
      logger.warning(`Skipping ${description} copy`);
      return;
    }

    // Ensure destination directory exists
    mkdirSync(dirname(dest), { recursive: true });

    // Read source file
    let content = readFileSync(source, 'utf-8');
    const originalContent = content;

    // Transform imports if this is neon.ts
    if (transformImports || dest.includes('neon.ts')) {
      content = transformNeonImports(content, originalContent, validate);
    }

    // Write destination file
    writeFileSync(dest, content, 'utf-8');

    logger.info(`✓ Copied ${description}`);
    logger.info(`  From: ${source.replace(rootDir, '.')}`);
    logger.info(`  To: ${dest.replace(rootDir, '.')}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to copy ${description}: ${errorMessage}`);
    throw error;
  }
}

/**
 * Transform Neon imports to use sub-module paths
 *
 * @param content - File content
 * @param originalContent - Original content for validation
 * @param shouldValidate - Whether to validate transformation
 * @returns Transformed content
 */
function transformNeonImports(
  content: string,
  originalContent: string,
  shouldValidate: boolean,
): string {
  logger.info('Discovering table mappings for neon.ts transformation...');
  const tableMapping = discoverTableMappings();

  // Validate we discovered tables
  validateTableMapping(tableMapping);

  // Generate new imports dynamically
  const newImports = generateNeonImports(tableMapping);

  // Replace the single import from '../core/index.js' with sub-module imports
  // Handles both 'import' and 'import type'
  const oldImportPattern = /import\s+(?:type\s+)?\{[^}]+\}\s+from\s+['"]\.\.\/core\/index\.js['"]/;

  if (!oldImportPattern.test(content)) {
    // Check if transformation already happened (new imports present)
    if (content.includes('@revealui/db/schema/')) {
      logger.info('File already has sub-module imports, skipping transformation');
    } else {
      const errorMessage = [
        'Expected import pattern not found in source file.',
        '',
        'Expected pattern:',
        "  import type { ... } from '../schema/index.js'",
        '',
        'Possible causes:',
        '  1. Source file format has changed',
        '  2. File was manually edited',
        '  3. Generation script output format changed',
        '',
        'To fix:',
        '  - Regenerate source file: pnpm --filter @revealui/db generate:types',
        '  - Then retry this script',
      ].join('\n');
      throw new ScriptError(errorMessage, ErrorCode.VALIDATION_ERROR);
    }
  } else {
    // Replace old import with new sub-module imports
    content = content.replace(oldImportPattern, newImports);
    logger.success('Transformed imports to use sub-module paths');
  }

  // Validate transformation if requested
  if (shouldValidate) {
    const validation = validateTransformation(originalContent, content, tableMapping);
    if (!validation.valid) {
      logger.error('Transformation validation failed:');
      for (const error of validation.errors) {
        logger.error(`  - ${error}`);
      }
      throw new ScriptError('Transformation validation failed', ErrorCode.VALIDATION_ERROR);
    }
    logger.success('Transformation validated successfully');
  }

  return content;
}

// =============================================================================
// Validation
// =============================================================================

/**
 * Validates that the transformation was successful
 *
 * Uses TypeScript Compiler API to parse and verify import structure.
 * Checks for:
 * - Old import pattern removal
 * - New import pattern presence
 * - All expected tables imported
 * - No duplicate imports
 * - Correct import paths
 *
 * @param originalContent - Original file content before transformation
 * @param transformedContent - File content after transformation
 * @param tableMapping - Expected table mapping to validate against
 * @returns Validation result with errors if any
 *
 * @example
 * ```typescript
 * const result = validateTransformation(original, transformed, mapping)
 * if (!result.valid) {
 *   console.error('Validation errors:', result.errors)
 * }
 * ```
 */
export function validateTransformation(
  _originalContent: string,
  transformedContent: string,
  tableMapping: TableMapping,
): ValidationResult {
  const errors: string[] = [];

  // Check that old import pattern is gone
  const oldImportPattern = /import\s+(?:type\s+)?\{[^}]+\}\s+from\s+['"]\.\.\/core\/index\.js['"]/;
  if (oldImportPattern.test(transformedContent)) {
    errors.push('Old import pattern still present in transformed content');
  }

  // Check that new imports are present
  if (!transformedContent.includes('@revealui/db/schema/')) {
    errors.push('New sub-module imports not found in transformed content');
  }

  // Parse imports using TypeScript Compiler API
  let importStatements: ParsedImport[] = [];
  try {
    importStatements = parseImports(transformedContent);
  } catch (error) {
    errors.push(
      `Failed to parse imports: ${error instanceof Error ? error.message : String(error)}`,
    );
    // Continue with other validations even if parsing fails
  }

  // Check that we have at least some imports
  if (importStatements.length === 0) {
    const importCount = (transformedContent.match(/from '@revealui\/db\/core\//g) || []).length;
    if (importCount === 0) {
      errors.push('No sub-module imports found in transformed content');
    } else {
      errors.push('Imports found but could not be parsed. This may indicate syntax errors.');
    }
  }

  // Verify all expected tables are imported
  const expectedTables = Object.values(tableMapping).flat();
  const importedTables = getAllImportedTables(importStatements);
  const missingTables = expectedTables.filter((table) => !importedTables.includes(table));
  if (missingTables.length > 0) {
    errors.push(`Missing table imports: ${missingTables.join(', ')}`);
  }

  // Verify no duplicate imports
  const tableCounts = new Map<string, number>();
  for (const table of importedTables) {
    tableCounts.set(table, (tableCounts.get(table) || 0) + 1);
  }
  const duplicates = Array.from(tableCounts.entries())
    .filter(([, count]) => count > 1)
    .map(([table]) => table);
  if (duplicates.length > 0) {
    errors.push(`Duplicate table imports: ${duplicates.join(', ')}`);
  }

  // Verify import paths are correct
  for (const imp of importStatements) {
    const subModuleFromPath = imp.path.replace('@revealui/db/schema/', '');
    // Find which sub-module these tables belong to
    let expectedSubModule: string | null = null;
    for (const [subModule, tables] of Object.entries(tableMapping)) {
      if (imp.tables.some((table) => tables.includes(table))) {
        expectedSubModule = subModule;
        break;
      }
    }

    if (expectedSubModule && subModuleFromPath !== expectedSubModule) {
      errors.push(
        `Import path mismatch for tables [${imp.tables.join(', ')}]: expected '@revealui/db/schema/${expectedSubModule}' but found '@revealui/db/schema/${subModuleFromPath}'`,
      );
    }

    // Verify all tables in this import belong to the same sub-module
    for (const table of imp.tables) {
      let foundSubModule: string | null = null;
      for (const [subModule, tables] of Object.entries(tableMapping)) {
        if (tables.includes(table)) {
          foundSubModule = subModule;
          break;
        }
      }

      if (foundSubModule && foundSubModule !== subModuleFromPath) {
        errors.push(
          `Table '${table}' imported from wrong sub-module: expected '@revealui/db/schema/${foundSubModule}' but found '@revealui/db/schema/${subModuleFromPath}'`,
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
