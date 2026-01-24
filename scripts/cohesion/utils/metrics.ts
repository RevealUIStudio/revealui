/**
 * Metrics generation utilities for Cohesion Engine
 */

import type { Metric, PatternAnalysis } from '../types.js'

/**
 * Generate metrics from pattern analyses
 */
export function generateMetrics(analyses: PatternAnalysis[]): Metric[] {
  const metrics: Metric[] = []

  // Total pattern instances
  const totalInstances = analyses.reduce((sum, analysis) => sum + analysis.total, 0)
  metrics.push({
    name: 'Total Pattern Instances',
    value: totalInstances,
    description: 'Total number of pattern instances found',
  })

  // Files affected
  const allFiles = new Set<string>()
  for (const analysis of analyses) {
    for (const instance of analysis.instances) {
      allFiles.add(instance.file)
    }
  }
  metrics.push({
    name: 'Files Affected',
    value: allFiles.size,
    files: Array.from(allFiles),
    description: 'Number of files containing pattern instances',
  })

  // Pattern-specific metrics
  for (const analysis of analyses) {
    metrics.push({
      name: `${analysis.description} Instances`,
      value: analysis.total,
      percentage: allFiles.size > 0 ? (analysis.total / allFiles.size) * 100 : 0,
      description: analysis.impact,
    })

    if (analysis.variations > 1) {
      metrics.push({
        name: `${analysis.description} Variations`,
        value: analysis.variations,
        description: `Number of variations of ${analysis.description}`,
      })
    }
  }

  // Severity breakdown
  const severityCounts = analyses.reduce(
    (acc, analysis) => {
      acc[analysis.severity] = (acc[analysis.severity] || 0) + analysis.total
      return acc
    },
    {} as Record<string, number>,
  )

  for (const [severity, count] of Object.entries(severityCounts)) {
    metrics.push({
      name: `${severity} Issues`,
      value: count,
      percentage: totalInstances > 0 ? (count / totalInstances) * 100 : 0,
      description: `Number of ${severity} severity issues`,
    })
  }

  return metrics
}

/**
 * Calculate overall grade from analyses
 */
export function calculateGrade(analyses: PatternAnalysis[]): string {
  const criticalCount = analyses.filter((a) => a.severity === 'CRITICAL').length
  const highCount = analyses.filter((a) => a.severity === 'HIGH').length
  const mediumCount = analyses.filter((a) => a.severity === 'MEDIUM').length
  const totalCount = analyses.length

  if (criticalCount > 0 || highCount > totalCount * 0.5) {
    return 'D+ (Functional but Painful)'
  }

  if (highCount > 0 || mediumCount > totalCount * 0.5) {
    return 'C- (Functional but Needs Work)'
  }

  if (mediumCount > 0) {
    return 'C+ (Functional but Needs Improvement)'
  }

  return 'B (Good)'
}
