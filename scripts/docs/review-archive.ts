#!/usr/bin/env tsx

/**
 * Archive Review Script
 *
 * Reviews archive directory for files that can be safely deleted:
 * - Files older than retention period
 * - Files with no references in active docs
 * - Duplicate summaries/reports
 * - Obsolete assessments
 *
 * Usage:
 *   pnpm docs:review:archive [--dry-run] [--verbose]
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import fg from 'fast-glob'
import { createLogger, getProjectRoot } from '../shared/utils.js'

const logger = createLogger()
let verboseMode = false

interface ArchiveFile {
  path: string
  relativePath: string
  lastModified: Date
  daysSinceModified: number
  size: number
  category: string
  canDelete: boolean
  reason: string
  referenced: boolean
}

interface ArchiveReview {
  totalFiles: number
  files: ArchiveFile[]
  recommendations: {
    safeToDelete: ArchiveFile[]
    keep: ArchiveFile[]
    review: ArchiveFile[]
  }
  summary: {
    total: number
    safeToDelete: number
    keep: number
    review: number
    totalSize: number
    deletableSize: number
  }
  generatedAt: Date
}

// Configuration
const RETENTION_POLICY = {
  minimum: 180, // Days - minimum retention
  default: 365, // Days - default retention
  permanent: ['README.md'], // Files to never delete
} as const

async function checkFileReferenced(filePath: string, projectRoot: string): Promise<boolean> {
  const relativePath = path.relative(path.join(projectRoot, 'docs', 'archive'), filePath)
  const fileName = path.basename(filePath, '.md')

  // Search for references in active documentation (excluding archive)
  const activeFiles = await fg(['**/*.md'], {
    cwd: projectRoot,
    ignore: ['docs/archive/**', 'node_modules/**', '.next/**', 'dist/**'],
    absolute: true,
  })

  for (const activeFile of activeFiles) {
    try {
      const content = await fs.readFile(activeFile, 'utf-8')
      if (content.includes(relativePath) || content.includes(fileName)) {
        return true
      }
    } catch (error) {
      // Skip files that can't be read
      if (verboseMode && error instanceof Error) {
        logger.warning(`⚠️  Could not check file ${activeFile}: ${error.message}`)
      }
      continue
    }
  }

  return false
}

function categorizeFile(filePath: string): string {
  const name = path.basename(filePath, '.md').toUpperCase()
  const dir = path.dirname(filePath)

  if (name.includes('ASSESSMENT')) return 'assessment'
  if (name.includes('SUMMARY')) return 'summary'
  if (name.includes('CLEANUP')) return 'cleanup'
  if (name.includes('STATUS')) return 'status'
  if (name.includes('COMPLETE')) return 'completion'
  if (dir.includes('assessments')) return 'assessment'
  if (dir.includes('documentation-cleanup')) return 'cleanup'

  return 'other'
}

function calculateDaysSince(date: Date): number {
  const now = new Date()
  const diffTime = Math.abs(now.getTime() - date.getTime())
  return Math.floor(diffTime / (1000 * 60 * 60 * 24))
}

async function reviewArchive(): Promise<ArchiveReview> {
  const projectRoot = getProjectRoot()
  const archiveDir = path.join(projectRoot, 'docs', 'archive')

  // Find all markdown files in archive
  const files = await fg(['**/*.md'], {
    cwd: archiveDir,
    absolute: true,
  })

  logger.info(`Reviewing ${files.length} files in archive...`)

  const archiveFiles: ArchiveFile[] = []

  for (const filePath of files) {
    const stats = await fs.stat(filePath)
    const relativePath = path.relative(projectRoot, filePath)
    const daysSinceModified = calculateDaysSince(stats.mtime)
    const category = categorizeFile(filePath)
    const fileName = path.basename(filePath)

    // Check if permanently kept
    if (RETENTION_POLICY.permanent.includes(fileName)) {
      archiveFiles.push({
        path: filePath,
        relativePath,
        lastModified: stats.mtime,
        daysSinceModified,
        size: stats.size,
        category,
        canDelete: false,
        reason: 'Permanently kept file',
        referenced: true,
      })
      continue
    }

    // Check if referenced in active docs
    const referenced = await checkFileReferenced(filePath, projectRoot)

    // Determine if can delete
    let canDelete = false
    let reason = ''

    if (daysSinceModified > RETENTION_POLICY.default) {
      if (!referenced) {
        canDelete = true
        reason = `Not referenced, ${daysSinceModified} days old (exceeds ${RETENTION_POLICY.default} day retention)`
      } else {
        reason = `Referenced in active docs, but ${daysSinceModified} days old`
      }
    } else if (daysSinceModified > RETENTION_POLICY.minimum && !referenced) {
      if (category === 'summary' || category === 'cleanup') {
        canDelete = true
        reason = `Summary/cleanup file, not referenced, ${daysSinceModified} days old`
      } else {
        reason = `Minimum retention period not met (${daysSinceModified} < ${RETENTION_POLICY.minimum})`
      }
    } else {
      reason = referenced
        ? 'Referenced in active documentation'
        : `Within minimum retention period (${daysSinceModified} < ${RETENTION_POLICY.minimum})`
    }

    archiveFiles.push({
      path: filePath,
      relativePath,
      lastModified: stats.mtime,
      daysSinceModified,
      size: stats.size,
      category,
      canDelete,
      reason,
      referenced,
    })
  }

  // Categorize recommendations
  const safeToDelete = archiveFiles.filter((f) => f.canDelete)
  const keep = archiveFiles.filter((f) => !f.canDelete && f.referenced)
  const review = archiveFiles.filter(
    (f) => !f.canDelete && !f.referenced && f.daysSinceModified < RETENTION_POLICY.default,
  )

  const totalSize = archiveFiles.reduce((sum, f) => sum + f.size, 0)
  const deletableSize = safeToDelete.reduce((sum, f) => sum + f.size, 0)

  const summary = {
    total: archiveFiles.length,
    safeToDelete: safeToDelete.length,
    keep: keep.length,
    review: review.length,
    totalSize,
    deletableSize,
  }

  return {
    totalFiles: files.length,
    files: archiveFiles,
    recommendations: {
      safeToDelete,
      keep,
      review,
    },
    summary,
    generatedAt: new Date(),
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`
}

function generateReportMarkdown(review: ArchiveReview): string {
  const lines: string[] = []

  lines.push('# Archive Review Report')
  lines.push('')
  lines.push(`**Generated**: ${review.generatedAt.toISOString()}`)
  lines.push(`**Total Files in Archive**: ${review.totalFiles}`)
  lines.push(`**Total Size**: ${formatBytes(review.summary.totalSize)}`)
  lines.push('')
  lines.push('## Summary')
  lines.push('')
  lines.push(`- 📦 **Total Files**: ${review.summary.total}`)
  lines.push(
    `- 🗑️  **Safe to Delete**: ${review.summary.safeToDelete} (${formatBytes(review.summary.deletableSize)})`,
  )
  lines.push(`- ✅ **Keep**: ${review.summary.keep}`)
  lines.push(`- ⚠️  **Review**: ${review.summary.review}`)
  lines.push('')

  if (review.recommendations.safeToDelete.length === 0) {
    lines.push('✅ **No files recommended for deletion at this time.**')
    lines.push('')
  } else {
    lines.push('## 🗑️ Files Safe to Delete')
    lines.push('')
    lines.push(
      `**Total**: ${review.summary.safeToDelete} files (${formatBytes(review.summary.deletableSize)})`,
    )
    lines.push('')

    // Group by category
    const byCategory = new Map<string, ArchiveFile[]>()
    for (const file of review.recommendations.safeToDelete) {
      if (!byCategory.has(file.category)) {
        byCategory.set(file.category, [])
      }
      byCategory.get(file.category)!.push(file)
    }

    for (const [category, files] of byCategory.entries()) {
      lines.push(`### ${category.toUpperCase()} (${files.length})`)
      lines.push('')
      for (const file of files.sort((a, b) => b.daysSinceModified - a.daysSinceModified)) {
        lines.push(`- **${path.relative('docs/archive', file.relativePath)}**`)
        lines.push(`  - Age: ${file.daysSinceModified} days`)
        lines.push(`  - Size: ${formatBytes(file.size)}`)
        lines.push(`  - Reason: ${file.reason}`)
        lines.push('')
      }
    }
  }

  if (review.recommendations.review.length > 0) {
    lines.push('## ⚠️ Files Requiring Review')
    lines.push('')
    lines.push(`**Total**: ${review.summary.review} files`)
    lines.push('')
    for (const file of review.recommendations.review) {
      lines.push(`- **${path.relative('docs/archive', file.relativePath)}**`)
      lines.push(`  - Age: ${file.daysSinceModified} days`)
      lines.push(`  - Category: ${file.category}`)
      lines.push(`  - Status: ${file.reason}`)
      lines.push('')
    }
  }

  lines.push('## Recommendations')
  lines.push('')
  if (review.summary.safeToDelete > 0) {
    lines.push(
      `1. **Delete ${review.summary.safeToDelete} files** - Safe to delete, saves ${formatBytes(review.summary.deletableSize)}`,
    )
    lines.push(
      '2. **Review flagged files** - Manual review recommended for files marked for review',
    )
  } else {
    lines.push(
      '1. **No files ready for deletion** - All files within retention period or referenced',
    )
    lines.push('2. **Check again in 3 months** - Files may become eligible for deletion')
  }
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
  verboseMode = verbose

  if (dryRun) {
    logger.info('📦 [DRY RUN] Reviewing archive directory...')
  } else {
    logger.info('📦 Reviewing archive directory...')
  }

  try {
    const review = await reviewArchive()

    const projectRoot = getProjectRoot()
    const reportDir = path.join(projectRoot, 'docs', 'reports')

    if (dryRun) {
      logger.info('[DRY RUN] Would generate report in:', reportDir)
      logger.info(`   Total files: ${review.summary.total}`)
      logger.info(`   Safe to delete: ${review.summary.safeToDelete}`)
      logger.info(`   Keep: ${review.summary.keep}`)
      logger.info(`   Review: ${review.summary.review}`)
      logger.info(`   Potential space savings: ${formatBytes(review.summary.deletableSize)}`)

      if (review.summary.safeToDelete > 0) {
        logger.warn(`⚠️  [DRY RUN] Would identify ${review.summary.safeToDelete} files for deletion`)
      } else {
        logger.info('✅ [DRY RUN] No files ready for deletion')
      }

      if (verbose) {
        logger.info('\n[DRY RUN] Report preview:')
        const preview = generateReportMarkdown(review)
        logger.info(preview.substring(0, 500) + (preview.length > 500 ? '...' : ''))
      }
      return
    }

    await fs.mkdir(reportDir, { recursive: true })
    const reportPath = path.join(reportDir, 'archive-review.md')
    const markdown = generateReportMarkdown(review)
    await fs.writeFile(reportPath, markdown, 'utf-8')

    logger.info(`✅ Report generated: ${reportPath}`)
    logger.info(`   Total files: ${review.summary.total}`)
    logger.info(`   Safe to delete: ${review.summary.safeToDelete}`)
    logger.info(`   Keep: ${review.summary.keep}`)
    logger.info(`   Review: ${review.summary.review}`)
    logger.info(`   Potential space savings: ${formatBytes(review.summary.deletableSize)}`)

    // Exit with 0 (don't fail CI) - this is informational
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`❌ Error reviewing archive: ${error.message}`)
      if (verbose && error.stack) {
        logger.error(`Stack trace: ${error.stack}`)
      }
    } else {
      logger.error('❌ Error reviewing archive: Unknown error')
      if (verbose) {
        logger.error(`Error object: ${JSON.stringify(error)}`)
      }
    }
    process.exit(1)
  }
}

main()
