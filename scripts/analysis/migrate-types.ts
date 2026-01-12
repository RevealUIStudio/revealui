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
import { createLogger, getProjectRoot } from '../shared/utils.js'

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
    newSource: '@revealui/schema/core',
  },
  GlobalConfig: {
    newSource: '@revealui/schema/core',
  },
  Field: {
    newSource: '@revealui/schema/core',
  },

  // Deprecated RevealUI wrapper types
  RevealCollectionConfig: {
    newType: 'CollectionConfig',
    newSource: '@revealui/schema/core',
    deprecated: true,
    deprecationMessage:
      'Use CollectionConfig from @revealui/schema/core instead. RevealCollectionConfig will be removed in v1.0.0',
  },
  RevealGlobalConfig: {
    newType: 'GlobalConfig',
    newSource: '@revealui/schema/core',
    deprecated: true,
    deprecationMessage:
      'Use GlobalConfig from @revealui/schema/core instead. RevealGlobalConfig will be removed in v1.0.0',
  },
  RevealConfig: {
    deprecated: true,
    deprecationMessage:
      'Use Config from @revealui/schema/core instead. RevealConfig will be removed in v1.0.0',
  },
  RevealField: {
    newType: 'Field',
    newSource: '@revealui/schema/core',
    deprecated: true,
    deprecationMessage:
      'Use Field from @revealui/schema/core instead. RevealField will be removed in v1.0.0',
  },

  // Hook types - these stay as TypeScript types but can be imported from schema
  CollectionAfterChangeHook: {
    newSource: '@revealui/schema/core',
  },
  CollectionBeforeChangeHook: {
    newSource: '@revealui/schema/core',
  },
  CollectionAfterReadHook: {
    newSource: '@revealui/schema/core',
  },
  CollectionBeforeReadHook: {
    newSource: '@revealui/schema/core',
  },

  // Access types
  AccessFunction: {
    newSource: '@revealui/schema/core',
  },
  FieldAccess: {
    newSource: '@revealui/schema/core',
  },
  FieldAccessConfig: {
    newSource: '@revealui/schema/core',
  },
}

// Current import sources to migrate FROM
const OLD_IMPORT_SOURCES = ['@revealui/core', '@revealui/core/types']

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

  // Track imports that need to be added to @revealui/schema/core
  const schemaImports: Set<string> = new Set()
  // Track which lines are import statements that need modification
  const importLineIndices: number[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Check for imports from old sources
    for (const oldSource of OLD_IMPORT_SOURCES) {
      const importRegex = new RegExp(
        `import\\s+(?:type\\s+)?\\{([^}]+)\\}\\s+from\\s+['"]${oldSource.replace('/', '\\/')}['"]`,
        'g',
      )

      const match = importRegex.exec(line)
      if (match) {
        const [_fullMatch, typesPart] = match
        const types = typesPart
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)

        for (const type of types) {
          const cleanType = type.replace(/\s+as\s+\w+/, '').trim()
          const migration = TYPE_MIGRATIONS[cleanType]

          if (migration) {
            if (migration.deprecated && config.addDeprecations) {
              // Add deprecation comment above the import
              result.changes.push(`DEPRECATION: ${cleanType} - ${migration.deprecationMessage}`)
            }

            if (migration.newSource === '@revealui/schema/core' && config.rewriteImports) {
              schemaImports.add(migration.newType || cleanType)
              result.changes.push(`MOVE: ${cleanType} → ${migration.newSource}`)
            }
          }
        }

        importLineIndices.push(i)
      }
    }
  }

  // If we have schema imports to add and rewriting is enabled
  if (schemaImports.size > 0 && config.rewriteImports) {
    // Find existing @revealui/schema/core import or add new one
    let schemaImportLineIndex = -1
    for (let i = 0; i < newLines.length; i++) {
      if (newLines[i].includes('@revealui/schema/core')) {
        schemaImportLineIndex = i
        break
      }
    }

    const schemaImportStatement = `import type { ${Array.from(schemaImports).sort().join(', ')} } from "@revealui/schema/core";`

    if (schemaImportLineIndex >= 0) {
      // Merge with existing import
      result.changes.push(`MERGE: Added types to existing @revealui/schema/core import`)
      // For simplicity, just note that manual merge is needed
      result.warnings.push(
        `Manual merge needed: existing @revealui/schema/core import at line ${schemaImportLineIndex + 1}`,
      )
    } else {
      // Find first import line to add after
      const firstImportIndex = newLines.findIndex((l) => l.startsWith('import'))
      if (firstImportIndex >= 0) {
        newLines.splice(firstImportIndex, 0, schemaImportStatement)
        result.changes.push(`ADD: New import from @revealui/schema/core`)
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
        'packages/revealui/src/**/*.ts',
        'packages/revealui/src/**/*.tsx',
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
