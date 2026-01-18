#!/usr/bin/env tsx

/**
 * Stale Documentation Detection Script
 *
 * Detects markdown files that haven't been updated recently and flags them for review.
 * Part of the autonomous documentation lifecycle management system.
 *
 * Usage:
 *   pnpm docs:check:stale [--dry-run] [--verbose]
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import fg from 'fast-glob'
import { createLogger, getProjectRoot } from '../shared/utils.js'

const logger = createLogger()

interface StaleDoc {
  path: string
  relativePath: string
  lastModified: Date
  daysSinceUpdate: number
  priority: 'high' | 'medium' | 'low'
  reason: string
  category: string
}

interface StaleReport {
  totalFiles: number
  staleFiles: StaleDoc[]
  summary: {
    critical: number
    high: number
    medium: number
    low: number
  }
  generatedAt: Date
}

// Configuration
const STALE_THRESHOLDS = {
  active: 90, // Days for regular docs
  critical: 180, // Days for critical docs (STATUS.md, PRODUCTION_READINESS.md)
  assessments: 30, // Days for assessment files
} as const

const SOURCES_OF_TRUTH = [
  'docs/STATUS.md',
  'docs/PRODUCTION_READINESS.md',
  'docs/PRODUCTION_ROADMAP.md',
  'README.md',
] as const

const EXCLUDE_PATTERNS = [
  'node_modules/**',
  '.next/**',
  'dist/**',
  'docs/archive/**',
  '**/coverage/**',
  'LICENSE.md',
  'CODE_OF_CONDUCT.md',
  'SECURITY.md',
]

async function getFileStats(filePath: string): Promise<{ mtime: Date; size: number }> {
  const stats = await fs.stat(filePath)
  return {
    mtime: stats.mtime,
    size: stats.size,
  }
}

function calculateDaysSince(date: Date): number {
  const now = new Date()
  const diffTime = Math.abs(now.getTime() - date.getTime())
  return Math.floor(diffTime / (1000 * 60 * 60 * 24))
}

function determinePriority(
  filePath: string,
  daysSinceUpdate: number,
  category: string,
): 'high' | 'medium' | 'low' {
  const isSourceOfTruth = SOURCES_OF_TRUTH.some((sot) => filePath.includes(sot))
  const isAssessment = category === 'assessment'
  const isStatus = category === 'status'

  if (isSourceOfTruth && daysSinceUpdate > STALE_THRESHOLDS.critical) {
    return 'high'
  }
  if (isAssessment && daysSinceUpdate > STALE_THRESHOLDS.assessments) {
    return 'high'
  }
  if (isStatus && daysSinceUpdate > STALE_THRESHOLDS.active) {
    return 'high'
  }
  if (daysSinceUpdate > STALE_THRESHOLDS.active * 2) {
    return 'medium'
  }
  if (daysSinceUpdate > STALE_THRESHOLDS.active) {
    return 'low'
  }

  return 'low'
}

function categorizeFile(filePath: string): string {
  const name = path.basename(filePath, '.md').toUpperCase()

  if (name.includes('ASSESSMENT')) return 'assessment'
  if (name.includes('STATUS')) return 'status'
  if (name.includes('COMPLETION')) return 'completion'
  if (name.includes('SUMMARY')) return 'summary'
  if (filePath.includes('guides/')) return 'guide'
  if (filePath.includes('development/')) return 'development'
  if (filePath.includes('reference/')) return 'reference'

  return 'other'
}

function getReason(daysSinceUpdate: number, category: string): string {
  if (category === 'assessment' && daysSinceUpdate > STALE_THRESHOLDS.assessments) {
    return `Assessment file not updated in ${daysSinceUpdate} days (threshold: ${STALE_THRESHOLDS.assessments} days)`
  }
  if (category === 'status' && daysSinceUpdate > STALE_THRESHOLDS.critical) {
    return `Status file not updated in ${daysSinceUpdate} days (threshold: ${STALE_THRESHOLDS.critical} days)`
  }
  if (daysSinceUpdate > STALE_THRESHOLDS.active) {
    return `File not updated in ${daysSinceUpdate} days (threshold: ${STALE_THRESHOLDS.active} days)`
  }

  return `File not updated in ${daysSinceUpdate} days`
}

async function detectStaleDocs(): Promise<StaleReport> {
  const projectRoot = getProjectRoot()
  const reportDir = path.join(projectRoot, 'docs', 'reports')

  // Ensure reports directory exists
  await fs.mkdir(reportDir, { recursive: true })

  // Find all markdown files
  const files = await fg(['**/*.md'], {
    cwd: projectRoot,
    ignore: EXCLUDE_PATTERNS,
    absolute: true,
  })

  logger.info(`Scanning ${files.length} markdown files...`)

  const staleFiles: StaleDoc[] = []

  for (const filePath of files) {
    const stats = await getFileStats(filePath)
    const daysSinceUpdate = calculateDaysSince(stats.mtime)
    const category = categorizeFile(filePath)

    // Check if file is stale
    const isStale =
      daysSinceUpdate > STALE_THRESHOLDS.active ||
      (category === 'assessment' && daysSinceUpdate > STALE_THRESHOLDS.assessments) ||
      (category === 'status' && daysSinceUpdate > STALE_THRESHOLDS.critical)

    if (isStale) {
      const relativePath = path.relative(projectRoot, filePath)
      const priority = determinePriority(relativePath, daysSinceUpdate, category)
      const reason = getReason(daysSinceUpdate, category)

      staleFiles.push({
        path: filePath,
        relativePath,
        lastModified: stats.mtime,
        daysSinceUpdate,
        priority,
        reason,
        category,
      })
    }
  }

  // Sort by priority and days since update
  staleFiles.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 }
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
    if (priorityDiff !== 0) return priorityDiff
    return b.daysSinceUpdate - a.daysSinceUpdate
  })

  const summary = {
    critical: staleFiles.filter((f) => f.priority === 'high').length,
    high: staleFiles.filter((f) => f.priority === 'high').length,
    medium: staleFiles.filter((f) => f.priority === 'medium').length,
    low: staleFiles.filter((f) => f.priority === 'low').length,
  }

  const report: StaleReport = {
    totalFiles: files.length,
    staleFiles,
    summary,
    generatedAt: new Date(),
  }

  return report
}

function generateReportMarkdown(report: StaleReport): string {
  const lines: string[] = []

  lines.push('# Stale Documentation Report')
  lines.push('')
  lines.push(`**Generated**: ${report.generatedAt.toISOString()}`)
  lines.push(`**Total Files Scanned**: ${report.totalFiles}`)
  lines.push(`**Stale Files Found**: ${report.staleFiles.length}`)
  lines.push('')
  lines.push('## Summary')
  lines.push('')
  lines.push(`- **High Priority**: ${report.summary.high}`)
  lines.push(`- **Medium Priority**: ${report.summary.medium}`)
  lines.push(`- **Low Priority**: ${report.summary.low}`)
  lines.push('')

  if (report.staleFiles.length === 0) {
    lines.push('✅ **No stale documentation found!**')
    lines.push('')
    return lines.join('\n')
  }

  lines.push('## Stale Files')
  lines.push('')

  // Group by priority
  const byPriority = {
    high: report.staleFiles.filter((f) => f.priority === 'high'),
    medium: report.staleFiles.filter((f) => f.priority === 'medium'),
    low: report.staleFiles.filter((f) => f.priority === 'low'),
  }

  for (const [priority, files] of Object.entries(byPriority) as Array<
    [keyof typeof byPriority, StaleDoc[]]
  >) {
    if (files.length === 0) continue

    const emoji = priority === 'high' ? '🔴' : priority === 'medium' ? '🟡' : '🟢'
    lines.push(`### ${emoji} ${priority.toUpperCase()} Priority (${files.length})`)
    lines.push('')

    for (const file of files) {
      lines.push(`- **${file.relativePath}**`)
      lines.push(`  - Category: ${file.category}`)
      lines.push(`  - Days since update: ${file.daysSinceUpdate}`)
      lines.push(`  - Last modified: ${file.lastModified.toISOString().split('T')[0]}`)
      lines.push(`  - Reason: ${file.reason}`)
      lines.push('')
    }
  }

  lines.push('## Recommendations')
  lines.push('')
  lines.push('1. **Review high priority files immediately** - These may be outdated')
  lines.push('2. **Update or archive medium priority files** - Review within 30 days')
  lines.push('3. **Review low priority files** - Update if still relevant')
  lines.push('')

  return lines.join('\n')
}

// Parse command line arguments
function parseArgs(args: string[]): { dryRun: boolean; verbose: boolean } {
  let dryRun = false
  let verbose = false

  for (const arg of args) {
    if (arg === '--dry-run' || arg === '--dryrun') {
      dryRun = true
    } else if (arg === '--verbose' || arg === '-v') {
      verbose = true
    }
  }

  return { dryRun, verbose }
}

async function main() {
  const { dryRun, verbose } = parseArgs(process.argv.slice(2))

  if (dryRun) {
    logger.info('🔍 [DRY RUN] Detecting stale documentation...')
  } else {
    logger.info('🔍 Detecting stale documentation...')
  }

  try {
    const report = await detectStaleDocs()

    const projectRoot = getProjectRoot()
    const reportDir = path.join(projectRoot, 'docs', 'reports')

    if (dryRun) {
      logger.info('[DRY RUN] Would generate report in:', reportDir)
      logger.info(`   Total files: ${report.totalFiles}`)
      logger.info(`   Stale files: ${report.staleFiles.length}`)
      logger.info(`   High priority: ${report.summary.high}`)
      logger.info(`   Medium priority: ${report.summary.medium}`)
      logger.info(`   Low priority: ${report.summary.low}`)

      if (report.staleFiles.length > 0) {
        logger.warn(`⚠️  [DRY RUN] Would warn about ${report.staleFiles.length} stale files`)
      } else {
        logger.info('✅ [DRY RUN] No stale files found!')
      }

      if (verbose) {
        logger.info('\n[DRY RUN] Report preview:')
        const preview = generateReportMarkdown(report)
        logger.info(preview.substring(0, 500) + (preview.length > 500 ? '...' : ''))
      }
      return
    }

    await fs.mkdir(reportDir, { recursive: true })
    const reportPath = path.join(reportDir, 'stale-docs-report.md')

    const markdown = generateReportMarkdown(report)
    await fs.writeFile(reportPath, markdown, 'utf-8')

    logger.info(`✅ Report generated: ${reportPath}`)
    logger.info(`   Total files: ${report.totalFiles}`)
    logger.info(`   Stale files: ${report.staleFiles.length}`)
    logger.info(`   High priority: ${report.summary.high}`)

    if (report.staleFiles.length > 0) {
      logger.warn(`⚠️  Found ${report.staleFiles.length} stale files requiring review`)
      process.exit(1) // Exit with error to trigger CI/CD alerts
    }
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`❌ Error detecting stale docs: ${error.message}`)
      if (verbose && error.stack) {
        logger.error(`Stack trace: ${error.stack}`)
      }
    } else {
      logger.error('❌ Error detecting stale docs: Unknown error')
      if (verbose) {
        logger.error(`Error object: ${JSON.stringify(error)}`)
      }
    }
    process.exit(1)
  }
}

main()
