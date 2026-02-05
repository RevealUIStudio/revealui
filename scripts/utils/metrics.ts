/**
 * Metrics Generation Utilities for Cohesion Engine
 *
 * Generates metrics and calculates overall quality grades.
 *
 * @dependencies
 * - scripts/types.ts - Type definitions (Metric, PatternAnalysis)
 */

import type { Metric, PatternAnalysis } from '../types.ts'

// =============================================================================
// Metrics Generation
// =============================================================================

/**
 * Generate metrics from pattern analyses
 */
export function generateMetrics(analyses: PatternAnalysis[]): Metric[] {
  const metrics: Metric[] = []

  // Total issues
  const totalIssues = analyses.reduce((sum, a) => sum + a.total, 0)
  metrics.push({
    name: 'Total Issues',
    value: totalIssues,
    description: 'Total number of cohesion issues found',
  })

  // Issues by severity
  const criticalIssues = analyses
    .filter((a) => a.severity === 'CRITICAL')
    .reduce((sum, a) => sum + a.total, 0)

  const highIssues = analyses
    .filter((a) => a.severity === 'HIGH')
    .reduce((sum, a) => sum + a.total, 0)

  const mediumIssues = analyses
    .filter((a) => a.severity === 'MEDIUM')
    .reduce((sum, a) => sum + a.total, 0)

  const lowIssues = analyses
    .filter((a) => a.severity === 'LOW')
    .reduce((sum, a) => sum + a.total, 0)

  metrics.push(
    {
      name: 'Critical Issues',
      value: criticalIssues,
      percentage: totalIssues > 0 ? (criticalIssues / totalIssues) * 100 : 0,
    },
    {
      name: 'High Priority Issues',
      value: highIssues,
      percentage: totalIssues > 0 ? (highIssues / totalIssues) * 100 : 0,
    },
    {
      name: 'Medium Priority Issues',
      value: mediumIssues,
      percentage: totalIssues > 0 ? (mediumIssues / totalIssues) * 100 : 0,
    },
    {
      name: 'Low Priority Issues',
      value: lowIssues,
      percentage: totalIssues > 0 ? (lowIssues / totalIssues) * 100 : 0,
    },
  )

  // Pattern diversity
  metrics.push({
    name: 'Pattern Types Found',
    value: analyses.length,
    description: 'Number of different anti-patterns detected',
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
    description: 'Number of files with cohesion issues',
  })

  return metrics
}

// =============================================================================
// Grade Calculation
// =============================================================================

/**
 * Calculate overall quality grade based on issues
 */
export function calculateGrade(analyses: PatternAnalysis[]): string {
  const totalIssues = analyses.reduce((sum, a) => sum + a.total, 0)

  if (totalIssues === 0) {
    return 'A+'
  }

  // Weight issues by severity
  let weightedScore = 0
  for (const analysis of analyses) {
    let weight = 1
    switch (analysis.severity) {
      case 'CRITICAL':
        weight = 10
        break
      case 'HIGH':
        weight = 5
        break
      case 'MEDIUM':
        weight = 2
        break
      case 'LOW':
        weight = 1
        break
    }
    weightedScore += analysis.total * weight
  }

  // Calculate grade based on weighted score
  if (weightedScore === 0) return 'A+'
  if (weightedScore < 10) return 'A'
  if (weightedScore < 50) return 'B'
  if (weightedScore < 100) return 'C'
  if (weightedScore < 200) return 'D'
  return 'F'
}

/**
 * Get severity color for terminal output
 */
export function getSeverityColor(severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'): string {
  switch (severity) {
    case 'CRITICAL':
      return '\x1b[31m' // Red
    case 'HIGH':
      return '\x1b[33m' // Yellow
    case 'MEDIUM':
      return '\x1b[36m' // Cyan
    case 'LOW':
      return '\x1b[37m' // White
  }
}

/**
 * Reset terminal color
 */
export function resetColor(): string {
  return '\x1b[0m'
}
