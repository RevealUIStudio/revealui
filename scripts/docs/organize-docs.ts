#!/usr/bin/env tsx

/**
 * Documentation Organization Script
 *
 * Reorganizes documentation files into the standardized directory structure.
 * Moves files to appropriate directories based on content and purpose.
 * Specifically handles organizing the docs root directory to keep only README.md.
 *
 * Usage:
 *   pnpm docs:organize
 *   pnpm docs:organize --dry-run
 */

import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as fg from 'fast-glob'
import { createLogger, getProjectRoot } from '../shared/utils.js'

const logger = createLogger()

interface DocMapping {
  source: string
  target: string
  category: 'guide' | 'reference' | 'development' | 'api' | 'archive' | 'root-cleanup'
  reason: string
}

interface OrganizationResult {
  moved: number
  skipped: number
  errors: number
  mappings: DocMapping[]
}

/**
 * File categorization mapping for docs root directory
 * Maps specific file patterns to their target subdirectories
 */
const DOCS_ROOT_CATEGORIES = new Map<string, string>([
  // Implementation and fix documentation
  ['P0_FIXES_IMPLEMENTATION', 'development/implementation'],
  ['P1_FIXES_IMPLEMENTATION', 'development/implementation'],
  ['P2_FIXES_IMPLEMENTATION', 'development/implementation'],
  ['FILE_SYSTEM_LOADING_IMPLEMENTATION', 'development/implementation'],
  ['FILE_LOADING_IMPLEMENTATION_ASSESSMENT', 'assessments'],

  // Assessment files
  ['BRUTAL_AGENT_WORK_ASSESSMENT', 'assessments'],
  ['BRUTAL_HONEST_ASSESSMENT', 'assessments'],
  ['TYPE_ERROR_AUDIT', 'assessments'],

  // Verification and status files
  ['VERIFICATION', 'assessments'],
  ['TEST_RESULTS', 'assessments'],
  ['ACTUAL_VERIFICATION_STATUS', 'assessments'],
  ['HONEST_VERIFICATION_STATUS', 'assessments'],
  ['ALL_FIXES_COMPLETE', 'assessments'],
  ['P0_FIXES_COMPLETE', 'assessments'],
  ['P0_FIXES_COMPLETED', 'assessments'],
  ['P1_VERIFICATION_COMPLETE', 'assessments'],
  ['CLEANUP_COMPLETE', 'assessments'],
  ['DOCUMENTATION_CLEANUP_SUMMARY', 'assessments'],
  ['CONSOLE_REPLACEMENT_SUMMARY', 'assessments'],

  // Documentation system files
  ['DOCUMENTATION_TOOLS', 'development'],
  ['DOCUMENTATION_INDEX', 'development'],
  ['DOCUMENTATION_STRATEGY', 'development'],
  ['IMPLEMENTATION_SUMMARY', 'development/implementation'],
  ['STRUCTURE', 'development'],
  ['ROOT_DOCS_POLICY', 'development'],
  ['ROOT_MARKDOWN_POLICY', 'development'],
  ['ROOT_MARKDOWN_CANDIDATES', 'development'],
  ['COVERAGE_REPORT_TEMPLATE', 'development'],

  // Auth documentation
  ['AUTH_MIGRATION_GUIDE', 'guides/auth'],
  ['AUTH_USAGE_EXAMPLES', 'guides/auth'],
  ['AUTH_SYSTEM_DESIGN', 'reference/auth'],

  // Database documentation
  ['DATABASE_MIGRATION_PLAN', 'reference/database'],
  ['DATABASE_PROVIDER_SWITCHING', 'reference/database'],
  ['FRESH_DATABASE_SETUP', 'guides/database'],
  ['FRESH_DATABASE_SUMMARY', 'reference/database'],
  ['DRIZZLE_GUIDE', 'reference/database'],
  ['TANSTACK_DB_IMPLEMENTATION_PLAN', 'reference/database'],
  ['TANSTACK_DB_CURRENT_STATE_ASSESSMENT', 'assessments'],
  ['TANSTACK_DB_BENEFITS_FOR_REVEALUI', 'reference/database'],
  ['TANSTACK_DB_ELECTRIC_RESEARCH', 'reference/database'],
  ['MIGRATE_VERCEL_POSTGRES_TO_SUPABASE', 'guides/database'],

  // Electric SQL
  ['electric_integration', 'reference/database'],
  ['electric_setup_guide', 'guides/database'],

  // Deployment
  ['DEPLOYMENT_RUNBOOK', 'guides/deployment'],
  ['CI_CD_GUIDE', 'guides/deployment'],
  ['DOCKER_WSL2_SETUP', 'guides/deployment'],
  ['ROLLBACK_PROCEDURE', 'guides/deployment'],
  ['LAUNCH_CHECKLIST', 'guides/deployment'],
  ['QUICK_START_PRE_LAUNCH', 'guides'],
  ['PENETRATION_TESTING_GUIDE', 'guides/security'],

  // Testing
  ['TESTING_STRATEGY', 'development/testing'],
  ['LOAD_TESTING_GUIDE', 'guides/testing'],
  ['MANUAL_VERIFICATION_CHECKLIST', 'development/testing'],

  // Environment and configuration
  ['ENV_VARIABLES_REFERENCE', 'reference/configuration'],
  ['ENVIRONMENT_VARIABLES_GUIDE', 'reference/configuration'],
  ['NEON_API_KEY_SETUP', 'guides/configuration'],
  ['SUPABASE_IPV4_EXPLANATION', 'reference/configuration'],

  // MCP documentation
  ['MCP_SETUP', 'mcp'],
  ['MCP_FIXES', 'mcp'],
  ['MCP_TEST_RESULTS', 'mcp'],
  ['NEXTJS_DEVTOOLS_MCP_DEMO', 'mcp'],
  ['demo_mcp_interaction', 'mcp'],

  // Architecture
  ['MULTI_TENANT_ARCHITECTURE', 'reference/architecture'],
  ['CUSTOM_INTEGRATIONS', 'reference/integrations'],

  // Other guides
  ['KNOWN_LIMITATIONS', 'reference'],
  ['LLM_CODE_STYLE_GUIDE', 'development'],
  ['LINT_ERRORS_REPORT', 'development'],
])

/**
 * Essential navigation files that must stay in docs root
 * These are part of the new documentation friendliness strategy
 */
const ESSENTIAL_DOCS_ROOT_FILES = [
  'README.md',
  'INDEX.md',
  'TASKS.md',
  'KEYWORDS.md',
  'STATUS.md',
  'AGENT_QUICK_START.md',
]

/**
 * Determine target directory for a file in docs root
 */
function getDocsRootTargetDirectory(filename: string): string | null {
  // Skip essential navigation files - must stay in docs root
  if (ESSENTIAL_DOCS_ROOT_FILES.includes(filename)) {
    return null
  }

  // Remove extension and normalize
  const baseName = filename.replace(/\.md$/, '').replace(/\./g, '_').toUpperCase()

  // Check for exact matches in FILE_CATEGORIES
  for (const [key, targetDir] of DOCS_ROOT_CATEGORIES) {
    if (baseName.includes(key)) {
      return targetDir
    }
  }

  // Default fallback categories
  if (baseName.includes('ASSESSMENT') || baseName.includes('VERIFICATION')) {
    return 'assessments'
  }

  if (baseName.includes('FIXES') || baseName.includes('IMPLEMENTATION')) {
    return 'development/implementation'
  }

  if (baseName.includes('TEST')) {
    return 'development/testing'
  }

  if (baseName.includes('DATABASE') || baseName.includes('DB')) {
    return 'reference/database'
  }

  if (baseName.includes('DEPLOYMENT') || baseName.includes('DEPLOY')) {
    return 'guides/deployment'
  }

  if (baseName.includes('AUTH')) {
    return 'guides/auth'
  }

  if (baseName.includes('MCP')) {
    return 'mcp'
  }

  // Default to development for unknown files
  return 'development'
}

// Mapping rules for organizing documentation (general organization)
const ORGANIZATION_RULES: Array<{
  pattern: RegExp | string
  category: 'guide' | 'reference' | 'development' | 'archive'
  targetDir: string
  description: string
}> = [
  // Guides - User-facing documentation
  {
    pattern: /^(getting-started|quick-start|tutorial|how-to|guide)/i,
    category: 'guide',
    targetDir: 'guides/getting-started',
    description: 'Getting started guides',
  },
  {
    pattern: /^(deployment|deploy|ci-cd|vercel|production)/i,
    category: 'guide',
    targetDir: 'guides/deployment',
    description: 'Deployment guides',
  },
  {
    pattern: /^(usage|using|example|blog|content|cms)/i,
    category: 'guide',
    targetDir: 'guides/usage',
    description: 'Usage guides',
  },
  {
    pattern: /(guide|tutorial|how-to)/i,
    category: 'guide',
    targetDir: 'guides',
    description: 'General guides',
  },
  // Reference - Technical reference
  {
    pattern: /^(api|reference|types|schema|config)/i,
    category: 'reference',
    targetDir: 'reference',
    description: 'API and reference docs',
  },
  {
    pattern: /(api|reference)/i,
    category: 'reference',
    targetDir: 'reference',
    description: 'Reference documentation',
  },
  // Development - Contributor docs
  {
    pattern: /^(contributing|development|architecture|testing|testing-strategy)/i,
    category: 'development',
    targetDir: 'development',
    description: 'Development documentation',
  },
  {
    pattern: /(contributing|development|architecture|testing)/i,
    category: 'development',
    targetDir: 'development',
    description: 'Development docs',
  },
  // Archive - Status and assessment files
  {
    pattern: /^(brutal|assessment|status|complete|fix|verification|result)/i,
    category: 'archive',
    targetDir: 'archive/status',
    description: 'Status and assessment files',
  },
  {
    pattern: /(assessment|status|complete|fix|verification)/i,
    category: 'archive',
    targetDir: 'archive/status',
    description: 'Status files',
  },
]

async function categorizeFile(
  fileName: string,
  filePath: string,
  docsRoot: string,
): Promise<DocMapping | null> {
  const baseName = path.basename(fileName, path.extname(fileName))
  const relativePath = path.relative(process.cwd(), filePath)

  // First, handle files in docs root directory
  const fileDir = path.dirname(filePath)
  if (fileDir === docsRoot || path.relative(docsRoot, fileDir) === '') {
    // This is a file directly in docs root
    const targetDir = getDocsRootTargetDirectory(fileName)
    if (targetDir) {
      const targetPath = path.join('docs', targetDir, fileName)
      return {
        source: relativePath,
        target: targetPath,
        category: 'root-cleanup',
        reason: `Organize docs root: move to ${targetDir}`,
      }
    }
    // README.md or other files that should stay in root
    return null
  }

  // Skip files that are already in the right place
  if (relativePath.startsWith('docs/api/')) {
    return null // API docs are auto-generated
  }
  if (relativePath.startsWith('docs/archive/')) {
    return null // Already archived
  }
  if (relativePath.startsWith('docs/guides/')) {
    return null // Already in guides
  }
  if (relativePath.startsWith('docs/reference/')) {
    return null // Already in reference
  }
  if (relativePath.startsWith('docs/development/')) {
    return null // Already in development
  }
  if (relativePath.startsWith('docs/assessments/')) {
    return null // Already in assessments
  }
  if (relativePath.startsWith('docs/mcp/')) {
    return null // Already in mcp
  }

  // Skip root-level essential files (project root, not docs root)
  // Essential root files that should stay in docs root
  // Includes navigation files from new documentation friendliness strategy
  const rootFiles = [
    'README.md',
    'INDEX.md',
    'TASKS.md',
    'KEYWORDS.md',
    'STATUS.md',
    'AGENT_QUICK_START.md',
  ]
  if (rootFiles.includes(fileName) && !relativePath.includes('docs/')) {
    return null
  }

  // Apply categorization rules for other files
  for (const rule of ORGANIZATION_RULES) {
    const pattern = typeof rule.pattern === 'string' ? new RegExp(rule.pattern, 'i') : rule.pattern
    if (pattern.test(baseName) || pattern.test(relativePath)) {
      const targetPath = path.join('docs', rule.targetDir, fileName)
      return {
        source: relativePath,
        target: targetPath,
        category: rule.category,
        reason: rule.description,
      }
    }
  }

  // If we get here and it's a docs file, keep it where it is
  if (relativePath.startsWith('docs/')) {
    return null // Keep in current location
  }

  // Should not reach here for files outside docs/
  return null
}

async function organizeDocumentation(dryRun = false): Promise<OrganizationResult> {
  const projectRoot = await getProjectRoot(import.meta.url)
  const docsDir = path.join(projectRoot, 'docs')
  const _rootDir = projectRoot

  logger.header('Documentation Organization')

  // Find all markdown files in docs directory only
  const docFiles = await fg(['docs/**/*.md'], {
    ignore: [
      'node_modules/**',
      '.next/**',
      'dist/**',
      'docs/archive/**',
      'docs/api/**', // Skip auto-generated API docs
    ],
    cwd: projectRoot,
  })

  logger.info(`Found ${docFiles.length} documentation files to analyze\n`)

  const mappings: DocMapping[] = []
  let moved = 0
  let skipped = 0
  let errors = 0

  for (const file of docFiles) {
    const filePath = path.join(projectRoot, file)
    const fileName = path.basename(file)

    try {
      const mapping = await categorizeFile(fileName, filePath, docsDir)
      if (mapping) {
        mappings.push(mapping)
      } else {
        skipped++
      }
    } catch (error) {
      logger.warning(
        `Failed to categorize ${file}: ${error instanceof Error ? error.message : String(error)}`,
      )
      errors++
    }
  }

  if (mappings.length === 0) {
    logger.info('No files need to be moved. Documentation is already well-organized!')
    return { moved: 0, skipped, errors, mappings: [] }
  }

  logger.info(`\nFound ${mappings.length} files to reorganize:\n`)

  // Group by category
  const byCategory = new Map<string, DocMapping[]>()
  for (const mapping of mappings) {
    const category = mapping.category
    if (!byCategory.has(category)) {
      byCategory.set(category, [])
    }
    const categoryMappings = byCategory.get(category)
    if (categoryMappings) {
      categoryMappings.push(mapping)
    }
  }

  // Display planned moves
  for (const [category, categoryMappings] of byCategory.entries()) {
    logger.info(`\n${category.toUpperCase().replace('-', ' ')} (${categoryMappings.length} files):`)
    for (const mapping of categoryMappings) {
      logger.info(`  ${mapping.source}`)
      logger.info(`    → ${mapping.target}`)
      logger.info(`    Reason: ${mapping.reason}`)
    }
  }

  if (dryRun) {
    logger.warning('\n[DRY RUN] No files were moved. Run without --dry-run to apply changes.')
    return { moved: 0, skipped, errors, mappings }
  }

  // Confirm before proceeding
  logger.info(`\n\nReady to move ${mappings.length} files.`)
  const { confirm } = await import('../shared/utils.js')
  const proceed = await confirm('Proceed with reorganization?', false)

  if (!proceed) {
    logger.info('Reorganization cancelled.')
    return { moved: 0, skipped, errors, mappings }
  }

  // Execute moves
  logger.info('\nMoving files...\n')

  for (const mapping of mappings) {
    try {
      const sourcePath = path.join(projectRoot, mapping.source)
      const targetPath = path.join(projectRoot, mapping.target)

      // Create target directory if it doesn't exist
      const targetDir = path.dirname(targetPath)
      await fs.mkdir(targetDir, { recursive: true })

      // Check if target already exists
      try {
        await fs.access(targetPath)
        logger.warning(`  ⚠️  Target exists, skipping: ${mapping.target}`)
        continue
      } catch {
        // File doesn't exist, proceed
      }

      // Move file
      await fs.rename(sourcePath, targetPath)
      logger.success(`  ✅ ${mapping.source} → ${mapping.target}`)
      moved++
    } catch (error) {
      logger.error(
        `  ❌ Failed to move ${mapping.source}: ${error instanceof Error ? error.message : String(error)}`,
      )
      errors++
    }
  }

  logger.info(`\n\nReorganization complete:`)
  logger.info(`  ✅ Moved: ${moved}`)
  logger.info(`  ⏭️  Skipped: ${skipped}`)
  if (errors > 0) {
    logger.warning(`  ❌ Errors: ${errors}`)
  }

  return { moved, skipped, errors, mappings }
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run') || args.includes('-d')

  try {
    await organizeDocumentation(dryRun)
  } catch (error) {
    logger.error(`Script failed: ${error instanceof Error ? error.message : String(error)}`)
    if (error instanceof Error && error.stack) {
      logger.error(`Stack trace: ${error.stack}`)
    }
    process.exit(1)
  }
}

main()
