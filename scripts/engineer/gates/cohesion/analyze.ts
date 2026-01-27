#!/usr/bin/env tsx
/**
 * Cohesion Engine - Analysis Command
 * Analyzes codebase for cohesion issues
 */

import { createLogger, getProjectRoot } from '../../utils/base.ts'
import { patternInstanceToCodeLocation } from '../utils/extraction.ts'
import { calculateGrade, generateMetrics } from '../utils/metrics.ts'
import { analyzePattern, COMMON_PATTERNS, findSourceFiles } from '../utils/patterns.ts'
import type { CohesionAnalysis, CohesionIssue, PatternAnalysis } from './types.ts'

const logger = createLogger()

/**
 * Convert pattern analysis to cohesion issue
 */
async function patternAnalysisToIssue(analysis: PatternAnalysis): Promise<CohesionIssue> {
  const evidence = await Promise.all(
    analysis.instances.slice(0, 10).map((instance) => patternInstanceToCodeLocation(instance)),
  )

  return {
    id: `issue-${analysis.pattern}`,
    title: analysis.description,
    severity: analysis.severity,
    impact: analysis.impact,
    description: `Found ${analysis.total} instances of ${analysis.description} across ${new Set(analysis.instances.map((i) => i.file)).size} files.`,
    evidence,
    pattern: analysis.pattern,
    count: analysis.total,
    recommendation: `Consider extracting this pattern into a shared utility or fixing the root cause.`,
  }
}

/**
 * Main analysis function
 */
async function analyze(): Promise<CohesionAnalysis> {
  const projectRoot = await getProjectRoot(import.meta.url)

  logger.header('Cohesion Engine - Analysis')

  // Find source files
  logger.info('Scanning for source files...')
  const targetDirectories = [
    `${projectRoot}/apps/cms/src`,
    `${projectRoot}/apps/web/src`,
    `${projectRoot}/packages/core/src`,
  ]

  const allFiles: string[] = []
  for (const dir of targetDirectories) {
    try {
      const files = await findSourceFiles(dir)
      allFiles.push(...files)
    } catch (_error) {
      logger.warning(`Could not scan directory: ${dir}`)
    }
  }

  logger.success(`Found ${allFiles.length} source files`)

  // Analyze patterns
  logger.info('Analyzing patterns...')
  const analyses: PatternAnalysis[] = []

  for (const matcher of COMMON_PATTERNS) {
    logger.info(`  Checking for: ${matcher.description}...`)
    const analysis = await analyzePattern(allFiles, matcher)
    if (analysis.total > 0) {
      analyses.push(analysis)
      logger.info(
        `    Found ${analysis.total} instances in ${new Set(analysis.instances.map((i) => i.file)).size} files`,
      )
    }
  }

  // Generate issues
  logger.info('Generating issues...')
  const issues = await Promise.all(analyses.map((a) => patternAnalysisToIssue(a)))

  // Generate metrics
  logger.info('Generating metrics...')
  const metrics = generateMetrics(analyses)

  // Calculate grade
  const grade = calculateGrade(analyses)

  // Generate summary
  const summary = {
    totalIssues: issues.length,
    criticalIssues: issues.filter((i) => i.severity === 'CRITICAL').length,
    highIssues: issues.filter((i) => i.severity === 'HIGH').length,
    mediumIssues: issues.filter((i) => i.severity === 'MEDIUM').length,
    lowIssues: issues.filter((i) => i.severity === 'LOW').length,
    overallGrade: grade,
  }

  const analysis: CohesionAnalysis = {
    timestamp: new Date().toISOString(),
    issues,
    metrics,
    summary,
  }

  logger.success('Analysis complete!')
  logger.info(
    `Found ${summary.totalIssues} issues (${summary.criticalIssues} critical, ${summary.highIssues} high)`,
  )
  logger.info(`Overall Grade: ${grade}`)

  return analysis
}

/**
 * Main function
 */
async function main() {
  try {
    const analysis = await analyze()

    // Output JSON to file
    const { writeFile } = await import('node:fs/promises')
    const { join } = await import('node:path')
    const projectRoot = await getProjectRoot(import.meta.url)
    const outputPath = join(projectRoot, '.cursor/cohesion-analysis.json')

    await writeFile(outputPath, JSON.stringify(analysis, null, 2))

    logger.success(`Analysis saved to: ${outputPath}`)
    logger.info('Run "pnpm cohesion:assess" to generate assessment document')
  } catch (error) {
    logger.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}

main()
