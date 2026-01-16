#!/usr/bin/env tsx
/**
 * Script to copy generated types to the centralized generated package.
 * This ensures generated types are accessible across the monorepo.
 *
 * Enhanced with:
 * - Dynamic table discovery from source files
 * - Automatic import generation
 * - Validation of transformations
 * - Comprehensive error handling
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createLogger } from '../shared/utils.js'
import { discoverTables, type DiscoveredTable, type DiscoveryResult } from '../../packages/db/src/types/discover.js'
import * as ts from 'typescript'

const logger = createLogger()

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '../..')

// Paths (updated to new location in @revealui/core)
const cmsTypesSource = join(rootDir, 'apps/cms/src/types/revealui.ts')
const cmsTypesDest = join(rootDir, 'packages/revealui/src/core/generated/types/cms.ts')
const supabaseTypesSource = join(rootDir, 'packages/services/src/core/supabase/types.ts')
const supabaseTypesDest = join(rootDir, 'packages/revealui/src/core/generated/types/supabase.ts')
const neonTypesSource = join(rootDir, 'packages/db/src/types/database.ts')
const neonTypesDest = join(rootDir, 'packages/revealui/src/core/generated/types/neon.ts')

/**
 * Maps sub-module names to their table exports
 * This is discovered dynamically from the actual source files
 */
export interface TableMapping {
  [subModule: string]: string[]
}

/**
 * Discovers which tables are exported from each sub-module
 * Uses TypeScript Compiler API via discoverTables() for robust parsing
 * 
 * @returns TableMapping grouped by sub-module name (derived from sourceFile)
 */
export function discoverTableMappings(): TableMapping {
  const discoveryResult = discoverTables()
  const { tables, errors } = discoveryResult

  // Log discovery errors as warnings
  if (errors.length > 0) {
    for (const error of errors) {
      const location = error.position
        ? `${error.file}:${error.position.line}:${error.position.column}`
        : error.file
      logger.warning(
        `Table discovery warning in ${location}: ${error.message}${error.context ? ` (${error.context})` : ''}`,
      )
    }
  }

  // Group tables by their sourceFile (sub-module name)
  const mapping: TableMapping = {}
  
  for (const table of tables) {
    // Extract sub-module name from sourceFile (e.g., "agents.ts" -> "agents")
    // sourceFile is relative to core directory, so it's just the filename
    const subModule = table.sourceFile.replace(/\.ts$/, '')
    
    if (!mapping[subModule]) {
      mapping[subModule] = []
    }
    
    mapping[subModule].push(table.variableName)
  }

  // Sort tables within each sub-module for consistency
  for (const subModule in mapping) {
    mapping[subModule].sort()
  }

  return mapping
}

/**
 * Generates import statements for neon.ts based on discovered table mappings
 * 
 * @param tableMapping - Tables grouped by sub-module name
 * @returns Formatted import block with proper syntax
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
      imports.push(`import { ${tables[0]} } from '@revealui/db/core/${subModulePath}'`)
    } else {
      // Multi-line import for multiple tables
      const tablesList = tables.map((t) => `  ${t}`).join(',\n')
      imports.push(
        `import {\n${tablesList},\n} from '@revealui/db/core/${subModulePath}'`,
      )
    }
  }

  return `// Import table definitions from db package sub-modules
// TypeScript with node16 module resolution requires explicit sub-module exports
// This import block is automatically generated based on actual table exports
${imports.join('\n')}`
}

/**
 * Parses import statements from TypeScript source content
 * Returns array of imported table names and their import paths
 */
function parseImports(content: string): Array<{ tables: string[]; path: string }> {
  const sourceFile = ts.createSourceFile(
    'temp.ts',
    content,
    ts.ScriptTarget.Latest,
    true,
  )

  const imports: Array<{ tables: string[]; path: string }> = []

  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node)) {
      const importPath = node.moduleSpecifier
      if (ts.isStringLiteral(importPath)) {
        const path = importPath.text

        // Only process imports from @revealui/db/core/*
        if (path.startsWith('@revealui/db/core/')) {
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
 * Validates that the transformation was successful
 * Uses TypeScript Compiler API to parse and verify import structure
 * 
 * @param originalContent - Original file content before transformation
 * @param transformedContent - File content after transformation
 * @param tableMapping - Expected table mapping to validate against
 * @returns Validation result with errors if any
 */
export function validateTransformation(
  originalContent: string,
  transformedContent: string,
  tableMapping: TableMapping,
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Check that old import pattern is gone
  const oldImportPattern = /import\s+(?:type\s+)?\{[^}]+\}\s+from\s+['"]\.\.\/core\/index\.js['"]/
  if (oldImportPattern.test(transformedContent)) {
    errors.push('Old import pattern still present in transformed content')
  }

  // Check that new imports are present
  if (!transformedContent.includes('@revealui/db/core/')) {
    errors.push('New sub-module imports not found in transformed content')
  }

  // Parse imports using TypeScript Compiler API
  let importStatements: Array<{ tables: string[]; path: string }> = []
  try {
    importStatements = parseImports(transformedContent)
  } catch (error) {
    errors.push(
      `Failed to parse imports: ${error instanceof Error ? error.message : String(error)}`,
    )
    // Continue with other validations even if parsing fails
  }

  // Check that we have at least some imports
  if (importStatements.length === 0) {
    const importCount = (transformedContent.match(/from '@revealui\/db\/core\//g) || []).length
    if (importCount === 0) {
      errors.push('No sub-module imports found in transformed content')
    } else {
      errors.push(
        'Imports found but could not be parsed. This may indicate syntax errors.',
      )
    }
  }

  // Verify all expected tables are imported
  const expectedTables = Object.values(tableMapping).flat()
  const importedTables = importStatements.flatMap((imp) => imp.tables)
  const missingTables = expectedTables.filter(
    (table) => !importedTables.includes(table),
  )
  if (missingTables.length > 0) {
    errors.push(`Missing table imports: ${missingTables.join(', ')}`)
  }

  // Verify no duplicate imports
  const tableCounts = new Map<string, number>()
  for (const table of importedTables) {
    tableCounts.set(table, (tableCounts.get(table) || 0) + 1)
  }
  const duplicates = Array.from(tableCounts.entries())
    .filter(([, count]) => count > 1)
    .map(([table]) => table)
  if (duplicates.length > 0) {
    errors.push(`Duplicate table imports: ${duplicates.join(', ')}`)
  }

  // Verify import paths are correct
  for (const imp of importStatements) {
    const subModuleFromPath = imp.path.replace('@revealui/db/core/', '')
    // Find which sub-module these tables belong to
    let expectedSubModule: string | null = null
    for (const [subModule, tables] of Object.entries(tableMapping)) {
      if (imp.tables.some((table) => tables.includes(table))) {
        expectedSubModule = subModule
        break
      }
    }

    if (expectedSubModule && subModuleFromPath !== expectedSubModule) {
      errors.push(
        `Import path mismatch for tables [${imp.tables.join(', ')}]: expected '@revealui/db/core/${expectedSubModule}' but found '@revealui/db/core/${subModuleFromPath}'`,
      )
    }

    // Verify all tables in this import belong to the same sub-module
    for (const table of imp.tables) {
      let foundSubModule: string | null = null
      for (const [subModule, tables] of Object.entries(tableMapping)) {
        if (tables.includes(table)) {
          foundSubModule = subModule
          break
        }
      }

      if (foundSubModule && foundSubModule !== subModuleFromPath) {
        errors.push(
          `Table '${table}' imported from wrong sub-module: expected '@revealui/db/core/${foundSubModule}' but found '@revealui/db/core/${subModuleFromPath}'`,
        )
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

function copyFile(source: string, dest: string, description: string) {
  try {
    // Validate source file exists
    if (!existsSync(source)) {
      logger.warning(`Source file not found: ${source.replace(rootDir, '.')}`)
      logger.warning(`Skipping ${description} copy`)
      return
    }

    // Ensure destination directory exists
    mkdirSync(dirname(dest), { recursive: true })

    // Read source file
    let content = readFileSync(source, 'utf-8')
    const originalContent = content

    // Transform imports for neon.ts (needs sub-module imports when copied to generated location)
    if (dest.includes('neon.ts')) {
      logger.info('Discovering table mappings for neon.ts transformation...')
      const tableMapping = discoverTableMappings()

      // Validate we discovered tables
      const totalTables = Object.values(tableMapping).flat().length
      const subModuleCount = Object.keys(tableMapping).length
      
      if (totalTables === 0) {
        const errorMessage = [
          'Failed to discover any tables from sub-modules. Cannot generate imports.',
          '',
          'Possible causes:',
          '  1. @revealui/db package is not built - run: pnpm --filter @revealui/db build',
          '  2. No pgTable exports found in packages/db/src/core/*.ts files',
          '  3. Table discovery errors occurred (check warnings above)',
          '',
          'To fix:',
          '  - Ensure packages/db/src/core/*.ts files contain pgTable exports',
          '  - Run: pnpm --filter @revealui/db generate:types',
          '  - Then retry this script',
        ].join('\n')
        throw new Error(errorMessage)
      }

      logger.info(
        `Discovered ${totalTables} tables across ${subModuleCount} sub-module${subModuleCount !== 1 ? 's' : ''}`,
      )

      // Generate new imports dynamically
      const newImports = generateNeonImports(tableMapping)

      // Replace the single import from '../core/index.js' with sub-module imports
      // Handles both 'import' and 'import type'
      const oldImportPattern =
        /import\s+(?:type\s+)?\{[^}]+\}\s+from\s+['"]\.\.\/core\/index\.js['"]/

      if (!oldImportPattern.test(content)) {
        // Check if transformation already happened (new imports present)
        if (content.includes('@revealui/db/core/')) {
          logger.info(
            'File already has sub-module imports, skipping transformation',
          )
        } else {
          const errorMessage = [
            "Expected import pattern not found in source file.",
            '',
            'Expected pattern:',
            "  import type { ... } from '../core/index.js'",
            '',
            'Possible causes:',
            '  1. Source file format has changed',
            '  2. File was manually edited',
            '  3. Generation script output format changed',
            '',
            'To fix:',
            '  - Regenerate source file: pnpm --filter @revealui/db generate:types',
            '  - Then retry this script',
            '',
            `Source file: ${source.replace(rootDir, '.')}`,
          ].join('\n')
          throw new Error(errorMessage)
        }
      } else {
        // Perform transformation
        content = content.replace(oldImportPattern, newImports)

        // Validate transformation
        const validation = validateTransformation(
          originalContent,
          content,
          tableMapping,
        )
        if (!validation.valid) {
          const errorMessage = [
            'Transformation validation failed:',
            '',
            ...validation.errors.map((e) => `  - ${e}`),
            '',
            'This indicates the transformation did not produce correct imports.',
            'Please report this issue with the source file content.',
          ].join('\n')
          throw new Error(errorMessage)
        }

        logger.info('✅ Transformation validated successfully')
      }
    }

    // Add header comment if not present
    const header = `/* tslint:disable */
/* eslint-disable */
/**
 * This file was automatically generated and copied from ${source.replace(rootDir, '.')}
 * DO NOT MODIFY IT BY HAND. Instead, regenerate the source file and re-run this script.
 *
 * Last updated: ${new Date().toISOString()}
 */

`

    // Write to destination
    writeFileSync(dest, header + content, 'utf-8')
    logger.success(`Copied ${description} to ${dest.replace(rootDir, '.')}`)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      logger.warning(`Source file not found: ${source.replace(rootDir, '.')}`)
      logger.warning(`Skipping ${description} copy`)
    } else {
      logger.error(`Error copying ${description}: ${error instanceof Error ? error.message : String(error)}`)
      if (error instanceof Error && error.stack) {
        logger.error(`Stack trace: ${error.stack}`)
      }
      process.exit(1)
    }
  }
}

// Copy CMS types
if (process.argv.includes('--cms') || process.argv.length === 2) {
  copyFile(cmsTypesSource, cmsTypesDest, 'CMS types')
}

// Copy Supabase types
if (process.argv.includes('--supabase') || process.argv.length === 2) {
  copyFile(supabaseTypesSource, supabaseTypesDest, 'Supabase types')
}

// Copy NeonDB types
// Note: neon.ts is copied to generated/types and uses sub-module imports from @revealui/db/core/*
// The db package exports sub-modules (./core/agents, ./core/cms, etc.) which neon.ts uses
if (process.argv.includes('--neon') || process.argv.length === 2) {
  copyFile(neonTypesSource, neonTypesDest, 'NeonDB types')
}

logger.success('Type copying complete!')
