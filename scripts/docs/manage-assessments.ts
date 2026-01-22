#!/usr/bin/env tsx

/**
 * Assessment File Management Script
 *
 * Manages assessment files - detects new assessments, checks integration status,
 * and archives assessments that have been integrated into main docs.
 *
 * Usage:
 *   pnpm docs:manage:assessments [--dry-run] [--verbose]
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import fg from 'fast-glob'
import { createLogger, getProjectRoot } from '../shared/utils.js'

const logger = createLogger()
let verboseMode = false

interface AssessmentFile {
  path: string
  relativePath: string
  category: 'package' | 'docs'
  lastModified: Date
  daysSinceUpdate: number
  status: 'active' | 'needs-review' | 'should-archive'
}

interface AssessmentReport {
  assessments: AssessmentFile[]
  violations: string[]
  recommendations: string[]
  generatedAt: Date
}

// Rules
const RULES = {
  // Only ONE assessment per package allowed
  maxAssessmentsPerPackage: 1,
  // Assessments in packages/* must be integrated or archived within 30 days
  gracePeriodDays: 30,
  // Assessment files allowed locations
  allowedLocations: {
    docs: ['docs/assessments/**'],
    archive: ['docs/archive/**'],
  },
  // Sources of truth that assessments should integrate into
  sourcesOfTruth: ['docs/STATUS.md', 'docs/PRODUCTION_READINESS.md', 'docs/PRODUCTION_ROADMAP.md'],
} as const

async function findAssessmentFiles(): Promise<string[]> {
  const projectRoot = getProjectRoot()

  // Find assessment files in packages
  const packageAssessments = await fg(['packages/*/*ASSESSMENT*.md', 'packages/*/ASSESSMENT*.md'], {
    cwd: projectRoot,
    absolute: true,
  })

  // Find assessment files in docs/assessments (but not archived)
  const docsAssessments = await fg(['docs/assessments/*ASSESSMENT*.md'], {
    cwd: projectRoot,
    absolute: true,
    ignore: ['docs/archive/**'],
  })

  return [...packageAssessments, ...docsAssessments]
}

function categorizePath(filePath: string): 'package' | 'docs' {
  return filePath.includes('packages/') ? 'package' : 'docs'
}

function calculateDaysSince(date: Date): number {
  const now = new Date()
  const diffTime = Math.abs(now.getTime() - date.getTime())
  return Math.floor(diffTime / (1000 * 60 * 60 * 24))
}

async function checkIntegrationStatus(filePath: string): Promise<boolean> {
  // Check if assessment content is referenced in sources of truth
  const projectRoot = getProjectRoot()
  const fileName = path.basename(filePath, '.md')

  for (const sourceOfTruth of RULES.sourcesOfTruth) {
    const sotPath = path.join(projectRoot, sourceOfTruth)
    try {
      const content = await fs.readFile(sotPath, 'utf-8')
      // Simple check: if filename or key phrases are mentioned
      if (
        content.includes(fileName) ||
        content.includes('CLEANUP COMPLETED') ||
        content.includes('Phase 1 Complete')
      ) {
        return true
      }
    } catch (error) {
      // File doesn't exist or can't be read - continue checking other files
      if (verboseMode && error instanceof Error) {
        logger.warning(`⚠️  Could not check source of truth ${sourceOfTruth}: ${error.message}`)
      }
      continue
    }
  }

  return false
}

async function analyzeAssessments(): Promise<AssessmentReport> {
  const projectRoot = getProjectRoot()
  const assessmentFiles = await findAssessmentFiles()

  logger.info(`Found ${assessmentFiles.length} assessment files...`)

  const assessments: AssessmentFile[] = []
  const violations: string[] = []
  const recommendations: string[] = []

  // Group by package
  const packageGroups = new Map<string, string[]>()

  for (const filePath of assessmentFiles) {
    const stats = await fs.stat(filePath)
    const relativePath = path.relative(projectRoot, filePath)
    const category = categorizePath(filePath)
    const daysSinceUpdate = calculateDaysSince(stats.mtime)

    // Check if in package directory
    if (category === 'package') {
      const packageMatch = relativePath.match(/packages\/([^/]+)\//)
      if (packageMatch) {
        const packageName = packageMatch[1]
        if (!packageGroups.has(packageName)) {
          packageGroups.set(packageName, [])
        }
        packageGroups.get(packageName)!.push(relativePath)
      }
    }

    // Determine status
    let status: AssessmentFile['status'] = 'active'
    if (category === 'package' && daysSinceUpdate > RULES.gracePeriodDays) {
      const isIntegrated = await checkIntegrationStatus(filePath)
      status = isIntegrated ? 'should-archive' : 'needs-review'
    }

    assessments.push({
      path: filePath,
      relativePath,
      category,
      lastModified: stats.mtime,
      daysSinceUpdate,
      status,
    })
  }

  // Check for violations
  for (const [packageName, files] of packageGroups.entries()) {
    if (files.length > RULES.maxAssessmentsPerPackage) {
      violations.push(
        `Package "${packageName}" has ${files.length} assessment files (max: ${RULES.maxAssessmentsPerPackage})`,
      )
      recommendations.push(`Archive or delete excess assessment files in packages/${packageName}/`)
    }
  }

  // Generate recommendations
  const packageAssessments = assessments.filter((a) => a.category === 'package')
  if (packageAssessments.length > 0) {
    recommendations.push(
      `Found ${packageAssessments.length} assessment files in packages/ - these should be in docs/assessments/ or archived`,
    )
  }

  const shouldArchive = assessments.filter((a) => a.status === 'should-archive')
  if (shouldArchive.length > 0) {
    recommendations.push(
      `Found ${shouldArchive.length} assessment files that should be archived (integrated into main docs)`,
    )
  }

  return {
    assessments,
    violations,
    recommendations,
    generatedAt: new Date(),
  }
}

function generateReportMarkdown(report: AssessmentReport): string {
  const lines: string[] = []

  lines.push('# Assessment File Management Report')
  lines.push('')
  lines.push(`**Generated**: ${report.generatedAt.toISOString()}`)
  lines.push(`**Total Assessments**: ${report.assessments.length}`)
  lines.push(`**Violations**: ${report.violations.length}`)
  lines.push('')

  if (report.violations.length > 0) {
    lines.push('## 🚨 Violations')
    lines.push('')
    for (const violation of report.violations) {
      lines.push(`- ❌ ${violation}`)
    }
    lines.push('')
  }

  if (report.recommendations.length > 0) {
    lines.push('## 📋 Recommendations')
    lines.push('')
    for (const rec of report.recommendations) {
      lines.push(`- ${rec}`)
    }
    lines.push('')
  }

  if (report.assessments.length === 0) {
    lines.push('✅ **No assessment files found!**')
    lines.push('')
    return lines.join('\n')
  }

  lines.push('## Assessment Files')
  lines.push('')

  // Group by status
  const byStatus = {
    'should-archive': report.assessments.filter((a) => a.status === 'should-archive'),
    'needs-review': report.assessments.filter((a) => a.status === 'needs-review'),
    active: report.assessments.filter((a) => a.status === 'active'),
  }

  for (const [status, files] of Object.entries(byStatus) as Array<
    [keyof typeof byStatus, AssessmentFile[]]
  >) {
    if (files.length === 0) continue

    const emoji = status === 'should-archive' ? '📦' : status === 'needs-review' ? '⚠️' : '✅'
    lines.push(`### ${emoji} ${status.replace(/-/g, ' ').toUpperCase()} (${files.length})`)
    lines.push('')

    for (const file of files) {
      lines.push(`- **${file.relativePath}**`)
      lines.push(`  - Category: ${file.category}`)
      lines.push(`  - Days since update: ${file.daysSinceUpdate}`)
      lines.push(`  - Status: ${file.status}`)
      lines.push('')
    }
  }

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
    logger.info('📋 [DRY RUN] Managing assessment files...')
  } else {
    logger.info('📋 Managing assessment files...')
  }

  try {
    const report = await analyzeAssessments()

    const projectRoot = getProjectRoot()
    const reportDir = path.join(projectRoot, 'docs', 'reports')

    if (dryRun) {
      logger.info('[DRY RUN] Would generate report in:', reportDir)
      logger.info(`   Total assessments: ${report.assessments.length}`)
      logger.info(`   Violations: ${report.violations.length}`)

      if (report.violations.length > 0) {
        logger.warn(`⚠️  [DRY RUN] Would warn about ${report.violations.length} violations`)
      } else {
        logger.info('✅ [DRY RUN] No violations found!')
      }

      if (verbose) {
        logger.info('\n[DRY RUN] Report preview:')
        const preview = generateReportMarkdown(report)
        logger.info(preview.substring(0, 500) + (preview.length > 500 ? '...' : ''))
      }
      return
    }

    await fs.mkdir(reportDir, { recursive: true })
    const reportPath = path.join(reportDir, 'assessments-report.md')

    const markdown = generateReportMarkdown(report)
    await fs.writeFile(reportPath, markdown, 'utf-8')

    logger.info(`✅ Report generated: ${reportPath}`)
    logger.info(`   Total assessments: ${report.assessments.length}`)
    logger.info(`   Violations: ${report.violations.length}`)

    if (report.violations.length > 0) {
      logger.warn(`⚠️  Found ${report.violations.length} violations`)
      process.exit(1)
    }
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`❌ Error managing assessments: ${error.message}`)
      if (verbose && error.stack) {
        logger.error(`Stack trace: ${error.stack}`)
      }
    } else {
      logger.error('❌ Error managing assessments: Unknown error')
      if (verbose) {
        logger.error(`Error object: ${JSON.stringify(error)}`)
      }
    }
    process.exit(1)
  }
}

main()
