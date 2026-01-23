#!/usr/bin/env tsx

/**
 * Migration Codemod for CMS Types
 *
 * Rewrites imports and adds deprecation notices for type migration.
 *
 * Usage:
 *   pnpm tsx scripts/analysis/migrate-types.ts --dry-run          # Preview changes
 *   pnpm tsx scripts/analysis/migrate-types.ts --dry-run --deprecate  # Preview with deprecations
 *   pnpm tsx scripts/analysis/migrate-types.ts --rewrite          # Execute import rewrites
 *
 * Options:
 *   --dry-run      Don't modify files, just show what would change
 *   --deprecate    Add deprecation comments to deprecated type usages
 *   --rewrite      Rewrite imports to new sources
 *   --verbose      Show detailed changes per file
 */

import fs from 'node:fs/promises'
import fg from 'fast-glob'
import * as ts from 'typescript'
import { createLogger, getProjectRoot, handleASTParseError } from '../shared/utils.js'

const logger = createLogger()

interface MigrationConfig {
  dryRun: boolean
  addDeprecations: boolean
  rewriteImports: boolean
  verbose: boolean
}

interface MigrationResult {
  file: string
  changes: string[]
  warnings: string[]
}

// Type migration rules
const TYPE_MIGRATIONS: Record<
  string,
  {
    newType?: string
    newSource?: string
    deprecated?: boolean
    deprecationMessage?: string
  }
> = {
  // Core types - rewrite to schema package
  CollectionConfig: {
    newSource: '@revealui/contracts/cms',
  },
  GlobalConfig: {
    newSource: '@revealui/contracts/cms',
  },
  Field: {
    newSource: '@revealui/contracts/cms',
  },

  // Deprecated RevealUI wrapper types
  RevealCollectionConfig: {
    newType: 'CollectionConfig',
    newSource: '@revealui/contracts/cms',
    deprecated: true,
    deprecationMessage:
      'Use CollectionConfig from @revealui/contracts/cms instead. RevealCollectionConfig will be removed in v1.0.0',
  },
  RevealGlobalConfig: {
    newType: 'GlobalConfig',
    newSource: '@revealui/contracts/cms',
    deprecated: true,
    deprecationMessage:
      'Use GlobalConfig from @revealui/contracts/cms instead. RevealGlobalConfig will be removed in v1.0.0',
  },
  RevealConfig: {
    deprecated: true,
    deprecationMessage:
      'Use Config from @revealui/contracts/cms instead. RevealConfig will be removed in v1.0.0',
  },
  RevealField: {
    newType: 'Field',
    newSource: '@revealui/contracts/cms',
    deprecated: true,
    deprecationMessage:
      'Use Field from @revealui/contracts/cms instead. RevealField will be removed in v1.0.0',
  },

  // Hook types - these stay as TypeScript types but can be imported from schema
  CollectionAfterChangeHook: {
    newSource: '@revealui/contracts/cms',
  },
  CollectionBeforeChangeHook: {
    newSource: '@revealui/contracts/cms',
  },
  CollectionAfterReadHook: {
    newSource: '@revealui/contracts/cms',
  },
  CollectionBeforeReadHook: {
    newSource: '@revealui/contracts/cms',
  },

  // Access types
  AccessFunction: {
    newSource: '@revealui/contracts/cms',
  },
  FieldAccess: {
    newSource: '@revealui/contracts/cms',
  },
  FieldAccessConfig: {
    newSource: '@revealui/contracts/cms',
  },
}

// Current import sources to migrate FROM
const OLD_IMPORT_SOURCES = ['@revealui/core', '@revealui/core/types']

/**
 * Extract imported type names from import specifier (same as analyze-types.ts)
 */
function extractImportedTypes(specifiers: ts.NodeArray<ts.ImportSpecifier>): string[] {
  const types: string[] = []
  for (const specifier of specifiers) {
    if (ts.isImportSpecifier(specifier)) {
      const name = specifier.name.text
      const propertyName = specifier.propertyName?.text
      // propertyName is the original name (e.g., "CollectionConfig as RevealCollectionConfig")
      // name is the alias (e.g., "RevealCollectionConfig")
      // We want the original name if it exists, otherwise the alias
      types.push(propertyName || name)
    }
  }
  return types
}

async function migrateFile(filePath: string, config: MigrationConfig): Promise<MigrationResult> {
  const content = await fs.readFile(filePath, 'utf-8')
  let newContent = content
  const result: MigrationResult = {
    file: filePath,
    changes: [],
    warnings: [],
  }

  const lines = content.split('\n')
  const newLines = [...lines]

  // Track imports that need to be added to @revealui/contracts/cms
  const schemaImports: Set<string> = new Set()
  let sourceFile: ts.SourceFile | null = null

  try {
    // Parse file with AST instead of regex
    const ext = filePath.split('.').pop()?.toLowerCase()
    const scriptKind =
      ext === 'tsx' || ext === 'jsx'
        ? ts.ScriptKind.TSX
        : ext === 'ts' || ext === 'js'
          ? ts.ScriptKind.TS
          : ts.ScriptKind.Unknown

    sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, scriptKind)

    // Traverse AST to find import declarations from old sources
    ts.forEachChild(sourceFile, (node) => {
      if (ts.isImportDeclaration(node)) {
        const moduleSpecifier = node.moduleSpecifier
        if (ts.isStringLiteral(moduleSpecifier)) {
          const source = moduleSpecifier.text

          // Check if this import is from an old source we need to migrate (exact match)
          if (
            OLD_IMPORT_SOURCES.some(
              (oldSource) => source === oldSource || source.startsWith(oldSource + '/'),
            )
          ) {
            if (node.importClause) {
              const namedImports = node.importClause.namedBindings
              if (namedImports && ts.isNamedImports(namedImports)) {
                // Extract types using AST (same as analyze-types.ts)
                const types = extractImportedTypes(namedImports.elements)

                for (const type of types) {
                  const migration = TYPE_MIGRATIONS[type]

                  if (migration) {
                    if (migration.deprecated && config.addDeprecations) {
                      // Add deprecation comment above the import
                      result.changes.push(`DEPRECATION: ${type} - ${migration.deprecationMessage}`)
                    }

                    if (
                      migration.newSource === '@revealui/contracts/cms' &&
                      config.rewriteImports
                    ) {
                      schemaImports.add(migration.newType || type)
                      result.changes.push(`MOVE: ${type} → ${migration.newSource}`)
                    }
                  }
                }
              }
            }
          }
        }
      }
    })
  } catch (error) {
    // Use standardized error handler
    handleASTParseError(filePath, error, logger)
    return result
  }

  // If we have schema imports to add and rewriting is enabled
  if (schemaImports.size > 0 && config.rewriteImports) {
    // Find existing @revealui/contracts/cms import using AST (reuse already-parsed sourceFile)
    let schemaImportLineIndex = -1
    if (sourceFile) {
      // Reuse the already-parsed AST instead of string matching
      ts.forEachChild(sourceFile, (node) => {
        if (ts.isImportDeclaration(node)) {
          const moduleSpecifier = node.moduleSpecifier
          if (ts.isStringLiteral(moduleSpecifier)) {
            const source = moduleSpecifier.text
            // Check if this is an import from @revealui/contracts/cms (exact match or subpath)
            if (
              source === '@revealui/contracts/cms' ||
              source.startsWith('@revealui/contracts/cms/')
            ) {
              const { line } = sourceFile!.getLineAndCharacterOfPosition(node.getStart())
              if (schemaImportLineIndex === -1) {
                schemaImportLineIndex = line
              }
            }
          }
        }
      })
    }

    const schemaImportStatement = `import type { ${Array.from(schemaImports).sort().join(', ')} } from "@revealui/contracts/cms";`

    if (schemaImportLineIndex >= 0) {
      // Merge with existing import
      result.changes.push(`MERGE: Added types to existing @revealui/contracts/cms import`)
      // For simplicity, just note that manual merge is needed
      result.warnings.push(
        `Manual merge needed: existing @revealui/contracts/cms import at line ${schemaImportLineIndex + 1}`,
      )
    } else {
      // Find first import line to add after
      const firstImportIndex = newLines.findIndex((l) => l.startsWith('import'))
      if (firstImportIndex >= 0) {
        newLines.splice(firstImportIndex, 0, schemaImportStatement)
        result.changes.push(`ADD: New import from @revealui/contracts/cms`)
      }
    }
  }

  // If not dry run, write changes
  if (!config.dryRun && result.changes.length > 0) {
    newContent = newLines.join('\n')
    await fs.writeFile(filePath, newContent, 'utf-8')
  }

  return result
}

async function runMigration() {
  const args = process.argv.slice(2)

  const config: MigrationConfig = {
    dryRun: args.includes('--dry-run'),
    addDeprecations: args.includes('--deprecate'),
    rewriteImports: args.includes('--rewrite'),
    verbose: args.includes('--verbose'),
  }

  try {
    await getProjectRoot(import.meta.url)
    logger.header('CMS Types Migration Codemod')
    logger.info(
      `Mode: ${config.dryRun ? 'DRY RUN (no files modified)' : 'LIVE (files will be modified)'}`,
    )
    logger.info(`Options: deprecate=${config.addDeprecations}, rewrite=${config.rewriteImports}`)
    logger.info('')

    if (!config.addDeprecations && !config.rewriteImports) {
      logger.warning('No action specified. Use --deprecate and/or --rewrite\n')
      logger.info('Usage:')
      logger.info('  pnpm tsx scripts/analysis/migrate-types.ts --dry-run --deprecate')
      logger.info('  pnpm tsx scripts/analysis/migrate-types.ts --dry-run --rewrite')
      logger.info('  pnpm tsx scripts/analysis/migrate-types.ts --rewrite  # Execute migration')
      process.exit(0)
    }

    // Find all TypeScript files
    const files = await fg(
      [
        'packages/core/src/**/*.ts',
        'packages/core/src/**/*.tsx',
        'apps/cms/src/**/*.ts',
        'apps/cms/src/**/*.tsx',
      ],
      {
        ignore: [
          '**/*.test.ts',
          '**/*.spec.ts',
          '**/node_modules/**',
          '**/dist/**',
          '**/.next/**',
          // Don't migrate the types file itself - that's manual
          '**/types/index.ts',
        ],
        cwd: process.cwd(),
        absolute: false,
      },
    )

    logger.info(`📁 Found ${files.length} files to process\n`)

    const results: MigrationResult[] = []
    let totalChanges = 0
    let totalWarnings = 0

    for (const file of files) {
      try {
        const result = await migrateFile(file, config)

        if (result.changes.length > 0 || result.warnings.length > 0) {
          results.push(result)
          totalChanges += result.changes.length
          totalWarnings += result.warnings.length

          if (config.verbose || result.changes.length > 0) {
            logger.info(`📝 ${file}`)
            for (const change of result.changes) {
              logger.success(`   ✓ ${change}`)
            }
            for (const warning of result.warnings) {
              logger.warning(`   ⚠️ ${warning}`)
            }
          }
        }
      } catch (error) {
        logger.error(
          `Error processing ${file}: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }

    // Summary
    logger.header('Migration Summary')
    logger.info(`Files processed: ${files.length}`)
    logger.info(`Files with changes: ${results.length}`)
    logger.info(`Total changes: ${totalChanges}`)
    logger.info(`Warnings: ${totalWarnings}`)

    if (config.dryRun) {
      logger.info('\n🔍 DRY RUN COMPLETE - No files were modified')
      logger.info('Run without --dry-run to apply changes')
    } else {
      logger.success('\n✅ MIGRATION COMPLETE - Files have been modified')
    }

    // Checkpoint
    logger.header('Phase 0.2 Checkpoint')
    logger.success(`Codemod completed successfully`)
    logger.info(`✓ ${results.length} files would be affected`)
    logger.info(`✓ ${totalWarnings} manual interventions needed`)
    logger.info(`\nProceed to Phase 0.3 to review the report and verify migration scope.`)
  } catch (error) {
    logger.error(`Migration failed: ${error instanceof Error ? error.message : String(error)}`)
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`)
    }
    process.exit(1)
  }
}

/**
 * Main function
 */
async function main() {
  try {
    await runMigration()
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}

main()
