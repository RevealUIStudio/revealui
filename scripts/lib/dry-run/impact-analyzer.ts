/**
 * Impact Analyzer
 *
 * Analyzes dry-run changes to assess impact, identify risks,
 * estimate duration, and assess rollback complexity.
 *
 * @example
 * ```typescript
 * const analyzer = new ImpactAnalyzer()
 * const changes = dryRun.getChanges()
 *
 * const analysis = analyzer.analyze(changes)
 *
 * console.log(`Impact: ${analysis.overallImpact}`)
 * console.log(`Rollback complexity: ${analysis.rollbackComplexity}`)
 * console.log(`Risks: ${analysis.risks.length}`)
 * ```
 */

import type { Change, ChangeType, ImpactLevel } from './dry-run-engine.js'

// =============================================================================
// Types
// =============================================================================

/**
 * Impact analysis result
 */
export interface ImpactAnalysis {
  /** Overall impact level */
  overallImpact: ImpactLevel

  /** Total number of changes */
  totalChanges: number

  /** Changes by type */
  changesByType: Record<ChangeType, number>

  /** Changes by impact level */
  changesByImpact: Record<ImpactLevel, number>

  /** Estimated duration in milliseconds */
  estimatedDuration: number

  /** Rollback complexity */
  rollbackComplexity: 'simple' | 'moderate' | 'complex'

  /** Identified risks */
  risks: Risk[]

  /** Recommendations */
  recommendations: string[]

  /** Affected resources */
  affectedResources: AffectedResource[]
}

/**
 * Identified risk
 */
export interface Risk {
  /** Risk severity */
  severity: 'low' | 'medium' | 'high' | 'critical'

  /** Risk category */
  category: 'data-loss' | 'breaking-change' | 'performance' | 'security' | 'other'

  /** Risk description */
  description: string

  /** Affected changes */
  affectedChanges: string[]

  /** Mitigation steps */
  mitigation?: string[]
}

/**
 * Affected resource
 */
export interface AffectedResource {
  /** Resource type */
  type: 'file' | 'database' | 'external'

  /** Resource identifier */
  identifier: string

  /** Number of operations on this resource */
  operationCount: number

  /** Impact level */
  impact: ImpactLevel
}

// =============================================================================
// Impact Analyzer
// =============================================================================

export class ImpactAnalyzer {
  /**
   * Analyze changes for impact
   */
  analyze(changes: Change[]): ImpactAnalysis {
    const changesByType = this.groupByType(changes)
    const changesByImpact = this.groupByImpact(changes)
    const affectedResources = this.analyzeAffectedResources(changes)
    const risks = this.identifyRisks(changes, changesByImpact)
    const rollbackComplexity = this.assessRollbackComplexity(changes)
    const estimatedDuration = this.estimateDuration(changes)
    const overallImpact = this.calculateOverallImpact(changesByImpact)
    const recommendations = this.generateRecommendations(changes, risks, overallImpact)

    return {
      overallImpact,
      totalChanges: changes.length,
      changesByType,
      changesByImpact,
      estimatedDuration,
      rollbackComplexity,
      risks,
      recommendations,
      affectedResources,
    }
  }

  /**
   * Generate impact summary text
   */
  generateSummary(analysis: ImpactAnalysis): string {
    const lines: string[] = []

    lines.push('Impact Analysis Summary')
    lines.push('='.repeat(60))
    lines.push('')
    lines.push(`Total Changes: ${analysis.totalChanges}`)
    lines.push(`Overall Impact: ${analysis.overallImpact.toUpperCase()}`)
    lines.push(`Rollback Complexity: ${analysis.rollbackComplexity}`)
    lines.push(`Estimated Duration: ${this.formatDuration(analysis.estimatedDuration)}`)
    lines.push('')

    // Changes by type
    lines.push('Changes by Type:')
    for (const [type, count] of Object.entries(analysis.changesByType)) {
      lines.push(`  ${type}: ${count}`)
    }
    lines.push('')

    // Affected resources
    if (analysis.affectedResources.length > 0) {
      lines.push('Affected Resources:')
      for (const resource of analysis.affectedResources.slice(0, 10)) {
        lines.push(`  ${resource.type}: ${resource.identifier} (${resource.operationCount} ops, ${resource.impact} impact)`)
      }
      if (analysis.affectedResources.length > 10) {
        lines.push(`  ... and ${analysis.affectedResources.length - 10} more`)
      }
      lines.push('')
    }

    // Risks
    if (analysis.risks.length > 0) {
      lines.push('Identified Risks:')
      for (const risk of analysis.risks) {
        lines.push(`  [${risk.severity.toUpperCase()}] ${risk.description}`)
        if (risk.mitigation) {
          lines.push(`    Mitigation: ${risk.mitigation.join(', ')}`)
        }
      }
      lines.push('')
    }

    // Recommendations
    if (analysis.recommendations.length > 0) {
      lines.push('Recommendations:')
      for (const rec of analysis.recommendations) {
        lines.push(`  - ${rec}`)
      }
    }

    return lines.join('\n')
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Group changes by type
   */
  private groupByType(changes: Change[]): Record<ChangeType, number> {
    const result = {} as Record<ChangeType, number>

    for (const change of changes) {
      result[change.type] = (result[change.type] || 0) + 1
    }

    return result
  }

  /**
   * Group changes by impact level
   */
  private groupByImpact(changes: Change[]): Record<ImpactLevel, number> {
    const result = {} as Record<ImpactLevel, number>

    for (const change of changes) {
      result[change.impact] = (result[change.impact] || 0) + 1
    }

    return result
  }

  /**
   * Analyze affected resources
   */
  private analyzeAffectedResources(changes: Change[]): AffectedResource[] {
    const resources = new Map<string, AffectedResource>()

    for (const change of changes) {
      const type = this.getResourceType(change.type)
      const key = `${type}:${change.target}`

      if (!resources.has(key)) {
        resources.set(key, {
          type,
          identifier: change.target,
          operationCount: 0,
          impact: 'low',
        })
      }

      const resource = resources.get(key)!
      resource.operationCount++

      // Upgrade impact level if necessary
      if (this.compareImpact(change.impact, resource.impact) > 0) {
        resource.impact = change.impact
      }
    }

    return Array.from(resources.values()).sort((a, b) => b.operationCount - a.operationCount)
  }

  /**
   * Identify risks
   */
  private identifyRisks(
    changes: Change[],
    changesByImpact: Record<ImpactLevel, number>,
  ): Risk[] {
    const risks: Risk[] = []

    // Check for critical/high impact changes
    if (changesByImpact.critical > 0) {
      risks.push({
        severity: 'critical',
        category: 'data-loss',
        description: `${changesByImpact.critical} critical changes detected (possible data loss)`,
        affectedChanges: changes.filter(c => c.impact === 'critical').map(c => c.id),
        mitigation: [
          'Create backup before proceeding',
          'Review each critical change carefully',
          'Consider testing in staging environment first',
        ],
      })
    }

    // Check for file deletions
    const deletions = changes.filter(c => c.type === 'file-delete')
    if (deletions.length > 0) {
      risks.push({
        severity: 'high',
        category: 'data-loss',
        description: `${deletions.length} file(s) will be deleted`,
        affectedChanges: deletions.map(c => c.id),
        mitigation: [
          'Verify files are no longer needed',
          'Create backup of deleted files',
        ],
      })
    }

    // Check for database deletions
    const dbDeletes = changes.filter(c => c.type === 'db-delete')
    if (dbDeletes.length > 0) {
      risks.push({
        severity: 'critical',
        category: 'data-loss',
        description: `${dbDeletes.length} database DELETE operation(s)`,
        affectedChanges: dbDeletes.map(c => c.id),
        mitigation: [
          'Create database backup',
          'Verify DELETE conditions are correct',
          'Test query in development first',
        ],
      })
    }

    // Check for many operations on same resource
    const affectedResources = this.analyzeAffectedResources(changes)
    const highActivityResources = affectedResources.filter(r => r.operationCount > 5)

    if (highActivityResources.length > 0) {
      risks.push({
        severity: 'medium',
        category: 'performance',
        description: `${highActivityResources.length} resource(s) with high operation count`,
        affectedChanges: changes.filter(c =>
          highActivityResources.some(r => r.identifier === c.target)
        ).map(c => c.id),
        mitigation: [
          'Consider batching operations',
          'Review for potential optimization',
        ],
      })
    }

    return risks
  }

  /**
   * Assess rollback complexity
   */
  private assessRollbackComplexity(changes: Change[]): 'simple' | 'moderate' | 'complex' {
    const hasDelete = changes.some(c => c.type === 'file-delete' || c.type === 'db-delete')
    const hasExternal = changes.some(c => c.type === 'command-exec')
    const hasCritical = changes.some(c => c.impact === 'critical')

    if (hasDelete || hasCritical) return 'complex'
    if (hasExternal || changes.length > 20) return 'moderate'
    return 'simple'
  }

  /**
   * Estimate execution duration
   */
  private estimateDuration(changes: Change[]): number {
    let totalMs = 0

    for (const change of changes) {
      switch (change.type) {
        case 'file-write':
          totalMs += 100 // 100ms per file write
          break
        case 'file-delete':
          totalMs += 50
          break
        case 'file-mkdir':
        case 'file-rmdir':
          totalMs += 20
          break
        case 'db-query':
        case 'db-insert':
        case 'db-update':
          totalMs += 500 // 500ms per DB operation
          break
        case 'db-delete':
          totalMs += 300
          break
        case 'command-exec':
          totalMs += 2000 // 2s per external command
          break
      }
    }

    return totalMs
  }

  /**
   * Calculate overall impact
   */
  private calculateOverallImpact(changesByImpact: Record<ImpactLevel, number>): ImpactLevel {
    if (changesByImpact.critical > 0) return 'critical'
    if (changesByImpact.high > 0) return 'high'
    if (changesByImpact.medium > 0) return 'medium'
    return 'low'
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(
    changes: Change[],
    risks: Risk[],
    overallImpact: ImpactLevel,
  ): string[] {
    const recommendations: string[] = []

    // Impact-based recommendations
    if (overallImpact === 'critical') {
      recommendations.push('Create full backup before proceeding')
      recommendations.push('Review all changes carefully before execution')
      recommendations.push('Consider testing in staging environment')
    } else if (overallImpact === 'high') {
      recommendations.push('Create backup of affected resources')
      recommendations.push('Review high-impact changes')
    }

    // Risk-based recommendations
    for (const risk of risks) {
      if (risk.severity === 'critical' || risk.severity === 'high') {
        recommendations.push(`Address ${risk.severity} risk: ${risk.description}`)
      }
    }

    // Operation-specific recommendations
    if (changes.length > 50) {
      recommendations.push('Consider breaking into smaller batches')
    }

    const dbOps = changes.filter(c => c.type.startsWith('db-'))
    if (dbOps.length > 10) {
      recommendations.push('Consider using database transactions for atomicity')
    }

    return recommendations
  }

  /**
   * Get resource type from change type
   */
  private getResourceType(changeType: ChangeType): 'file' | 'database' | 'external' {
    if (changeType.startsWith('file-')) return 'file'
    if (changeType.startsWith('db-')) return 'database'
    return 'external'
  }

  /**
   * Compare impact levels
   */
  private compareImpact(a: ImpactLevel, b: ImpactLevel): number {
    const order: ImpactLevel[] = ['low', 'medium', 'high', 'critical']
    return order.indexOf(a) - order.indexOf(b)
  }

  /**
   * Format duration for display
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${(ms / 60000).toFixed(1)}m`
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create an impact analyzer instance
 */
export function createImpactAnalyzer(): ImpactAnalyzer {
  return new ImpactAnalyzer()
}
