#!/usr/bin/env tsx

/**
 * Simple Cohesion Analysis Tool
 *
 * A simplified, maintainable version of cohesion analysis that focuses on
 * the most important metrics without the complex Ralph integration.
 *
 * Usage:
 *   pnpm cohesion:analyze
 *   pnpm cohesion:analyze --format json
 *   pnpm cohesion:analyze --focus database
 */

import { readdir, readFile } from 'node:fs/promises'
import { extname, join, relative } from 'node:path'
import { createLogger, getProjectRoot } from '../../utils/base.ts'

const logger = createLogger()

interface CohesionMetrics {
  files: number
  functions: number
  classes: number
  imports: number
  exports: number
  complexity: number
}

interface CohesionIssue {
  file: string
  type: 'high-coupling' | 'low-cohesion' | 'circular-dependency' | 'unused-export'
  severity: 'low' | 'medium' | 'high'
  message: string
  suggestion: string
}

interface CohesionReport {
  metrics: CohesionMetrics
  issues: CohesionIssue[]
  score: number // 0-100, higher is better
}

async function analyzeCohesion(
  options: { focus?: string; format?: 'text' | 'json' } = {},
): Promise<CohesionReport> {
  const { focus, format = 'text' } = options

  logger.header('Cohesion Analysis')

  const projectRoot = await getProjectRoot(import.meta.url)
  const sourceDirs = focus
    ? [join(projectRoot, focus)]
    : [join(projectRoot, 'apps'), join(projectRoot, 'packages')]

  const metrics: CohesionMetrics = {
    files: 0,
    functions: 0,
    classes: 0,
    imports: 0,
    exports: 0,
    complexity: 0,
  }

  const issues: CohesionIssue[] = []

  for (const sourceDir of sourceDirs) {
    try {
      const result = await analyzeDirectory(sourceDir, metrics, issues)
      Object.assign(metrics, result.metrics)
      issues.push(...result.issues)
    } catch (error) {
      logger.warning(`Failed to analyze ${sourceDir}: ${error}`)
    }
  }

  // Calculate cohesion score (simplified algorithm)
  const score = calculateCohesionScore(metrics, issues)

  const report: CohesionReport = {
    metrics,
    issues,
    score,
  }

  if (format === 'json') {
    console.log(JSON.stringify(report, null, 2))
  } else {
    displayReport(report)
  }

  return report
}

async function analyzeDirectory(
  dir: string,
  metrics: CohesionMetrics,
  _issues: CohesionIssue[],
): Promise<{ metrics: Partial<CohesionMetrics>; issues: CohesionIssue[] }> {
  const localMetrics: Partial<CohesionMetrics> = {}
  const localIssues: CohesionIssue[] = []

  async function scan(currentDir: string): Promise<void> {
    const entries = await readdir(currentDir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name)

      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        await scan(fullPath)
      } else if (entry.isFile() && ['.ts', '.tsx', '.js', '.jsx'].includes(extname(entry.name))) {
        const result = await analyzeFile(fullPath)
        metrics.files++

        // Aggregate metrics
        metrics.functions += result.functions
        metrics.classes += result.classes
        metrics.imports += result.imports
        metrics.exports += result.exports
        metrics.complexity += result.complexity

        // Add issues
        localIssues.push(...result.issues)
      }
    }
  }

  await scan(dir)

  return { metrics: localMetrics, issues: localIssues }
}

async function analyzeFile(filePath: string): Promise<{
  functions: number
  classes: number
  imports: number
  exports: number
  complexity: number
  issues: CohesionIssue[]
}> {
  const issues: CohesionIssue[] = []

  try {
    const content = await readFile(filePath, 'utf-8')
    const relativePath = relative(await getProjectRoot(import.meta.url), filePath)

    // Count functions, classes, imports, exports
    const functions =
      (content.match(/function\s+\w+\s*\(/g) || []).length +
      (content.match(/const\s+\w+\s*=\s*\(/g) || []).length

    const classes = (content.match(/class\s+\w+/g) || []).length
    const imports = (content.match(/^import\s+/gm) || []).length
    const exports = (content.match(/^export\s+/gm) || []).length

    // Simple complexity calculation
    const complexity = Math.max(1, functions + classes + imports / 2 + exports / 2)

    // Check for cohesion issues
    if (functions > 20) {
      issues.push({
        file: relativePath,
        type: 'high-coupling',
        severity: 'medium',
        message: `File has ${functions} functions - consider splitting into smaller modules`,
        suggestion: 'Break down large files into smaller, focused modules',
      })
    }

    if (imports > 15) {
      issues.push({
        file: relativePath,
        type: 'high-coupling',
        severity: 'low',
        message: `File has ${imports} imports - high coupling detected`,
        suggestion: 'Consider consolidating imports or breaking down dependencies',
      })
    }

    if (exports === 0 && functions > 0) {
      issues.push({
        file: relativePath,
        type: 'low-cohesion',
        severity: 'low',
        message: 'File has functions but no exports - may indicate private utilities',
        suggestion: 'Consider if this code should be exported or moved to a utility module',
      })
    }

    return {
      functions,
      classes,
      imports,
      exports,
      complexity,
      issues,
    }
  } catch (error) {
    return {
      functions: 0,
      classes: 0,
      imports: 0,
      exports: 0,
      complexity: 1,
      issues: [
        {
          file: relative(filePath),
          type: 'high-coupling',
          severity: 'low',
          message: `Failed to analyze file: ${error}`,
          suggestion: 'Check file permissions and syntax',
        },
      ],
    }
  }
}

function calculateCohesionScore(metrics: CohesionMetrics, issues: CohesionIssue[]): number {
  let score = 100

  // Penalize based on issues
  const highSeverity = issues.filter((i) => i.severity === 'high').length
  const mediumSeverity = issues.filter((i) => i.severity === 'medium').length

  score -= highSeverity * 10
  score -= mediumSeverity * 5

  // Penalize based on metrics
  if (metrics.complexity > metrics.files * 10) {
    score -= 10 // High complexity per file
  }

  if (metrics.imports > metrics.files * 5) {
    score -= 5 // High coupling
  }

  return Math.max(0, Math.min(100, score))
}

function displayReport(report: CohesionReport): void {
  logger.info(`Files analyzed: ${report.metrics.files}`)
  logger.info(`Functions: ${report.metrics.functions}`)
  logger.info(`Classes: ${report.metrics.classes}`)
  logger.info(`Imports: ${report.metrics.imports}`)
  logger.info(`Exports: ${report.metrics.exports}`)
  logger.info(
    `Average complexity: ${(report.metrics.complexity / report.metrics.files).toFixed(1)}`,
  )

  logger.info(`Cohesion score: ${report.score}/100`)

  if (report.score >= 80) {
    logger.success('Excellent cohesion!')
  } else if (report.score >= 60) {
    logger.warning('Good cohesion with some issues to address')
  } else {
    logger.error('Poor cohesion - significant refactoring needed')
  }

  if (report.issues.length > 0) {
    logger.info(`Found ${report.issues.length} cohesion issues:`)

    for (const issue of report.issues.slice(0, 10)) {
      const level = issue.severity === 'high' ? '❌' : issue.severity === 'medium' ? '⚠️' : 'ℹ️'
      logger.info(`${level} ${issue.file}: ${issue.message}`)
      logger.info(`   💡 ${issue.suggestion}`)
    }

    if (report.issues.length > 10) {
      logger.info(`... and ${report.issues.length - 10} more issues`)
    }
  }
}

async function main() {
  try {
    const args = process.argv.slice(2)
    const options: { focus?: string; format?: 'text' | 'json' } = {}

    for (let i = 0; i < args.length; i++) {
      const arg = args[i]
      if (arg === '--focus' && i + 1 < args.length) {
        options.focus = args[i + 1]
        i++
      } else if (arg === '--format' && i + 1 < args.length) {
        options.format = args[i + 1] as 'text' | 'json'
        i++
      }
    }

    await analyzeCohesion(options)
    logger.success('Cohesion analysis completed')
  } catch (error) {
    logger.error(`Cohesion analysis failed: ${error}`)
    process.exit(1)
  }
}

main()
