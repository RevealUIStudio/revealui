#!/usr/bin/env tsx
/**
 * Cohesion Engine - Automated Fix Command
 *
 * NOTE: This is a minimal structure for Phase 3.
 * Full implementation will be added after testing Phase 1 & 2.
 */

import {createLogger,fileExists,getProjectRoot,readFile} from '../../../packages/core/src/scripts/utils.ts'
import {applyFix,findFixStrategy} from '../utils/fixes.ts'
import type {CohesionAnalysis,CohesionIssue} from './types.ts'

const logger = createLogger()

/**
 * Main function
 */
async function main() {
  try {
    const projectRoot = await getProjectRoot(import.meta.url)
    const { join } = await import('node:path')
    const analysisPath = join(projectRoot, '.cursor/cohesion-analysis.json')

    logger.header('Cohesion Engine - Automated Fix')

    // Check if analysis exists
    if (!(await fileExists(analysisPath))) {
      logger.error(`Analysis file not found: ${analysisPath}`)
      logger.info('Run "pnpm cohesion:analyze" first to generate analysis')
      process.exit(1)
    }

    // Read analysis
    logger.info('Reading analysis results...')
    const analysisContent = await readFile(analysisPath)
    const analysis: CohesionAnalysis = JSON.parse(analysisContent)

    logger.success(`Loaded analysis with ${analysis.issues.length} issues`)

    // Parse command line arguments
    const args = process.argv.slice(2)
    const dryRun = args.includes('--dry-run') || args.includes('-d')
    const fixType = args.find((arg) => arg.startsWith('--fix-type='))?.split('=')[1]

    if (dryRun) {
      logger.info('DRY RUN MODE - No changes will be applied')
    }

    // Filter issues to fix
    let issuesToFix: CohesionIssue[] = analysis.issues

    if (fixType) {
      issuesToFix = issuesToFix.filter((issue) => issue.pattern === fixType)
      logger.info(`Filtering to fix type: ${fixType}`)
    }

    // Filter to issues that have fix strategies available
    issuesToFix = issuesToFix.filter((issue) => {
      const strategy = findFixStrategy(issue)
      return strategy !== null
    })

    if (issuesToFix.length === 0) {
      logger.warning('No fixable issues found')
      logger.info('Automated fix strategies not yet implemented')
      logger.info('This is Phase 3 - full implementation pending')
      process.exit(0)
    }

    logger.info(`Found ${issuesToFix.length} fixable issues`)

    // Apply fixes
    let fixed = 0
    let failed = 0
    let skipped = 0
    const allChanges: CodeChange[] = []

    for (const issue of issuesToFix.slice(0, 10)) {
      // Limit to 10 issues for now
      logger.info(`\nFixing: ${issue.title}...`)

      const fix = await applyFix(issue, dryRun)

      if (fix.success) {
        logger.success(`Fix applied: ${issue.title}`)
        logger.info(`  Changes: ${fix.changes.length} file(s)`)

        if (fix.changes.length > 0) {
          allChanges.push(...fix.changes)

          if (dryRun) {
            logger.info('DRY RUN - Changes would be:')
            for (const change of fix.changes.slice(0, 3)) {
              logger.info(`  ${change.file}:${change.line}`)
              logger.info(`    - ${change.before}`)
              logger.info(`    + ${change.after}`)
            }
            if (fix.changes.length > 3) {
              logger.info(`  ... ${fix.changes.length - 3} more changes`)
            }
          } else {
            logger.success(`  Applied ${fix.changes.length} change(s)`)
          }
        }

        fixed++
      } else {
        if (fix.errors && fix.errors.length > 0 && !fix.errors[0].includes('No fix strategy')) {
          logger.error(`Fix failed: ${issue.title}`)
          for (const error of fix.errors) {
            logger.error(`  - ${error}`)
          }
          failed++
        } else {
          logger.warning(`No fix strategy available: ${issue.title}`)
          skipped++
        }
      }
    }

    // Summary
    logger.header('Fix Summary')
    logger.info(`Fixed: ${fixed}`)
    logger.info(`Failed: ${failed}`)
    logger.info(`Skipped (no strategy): ${skipped}`)
    logger.info(`Remaining: ${issuesToFix.length - fixed - failed - skipped}`)
    logger.info(`Total changes: ${allChanges.length}`)

    if (dryRun) {
      logger.warning('DRY RUN MODE - No changes were applied')
      logger.info('Run without --dry-run to apply changes')
    } else {
      logger.success(
        `Applied ${allChanges.length} change(s) across ${new Set(allChanges.map((c) => c.file)).size} file(s)`,
      )
    }
  } catch (error) {
    logger.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}

main()
