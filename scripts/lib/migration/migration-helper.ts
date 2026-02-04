import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { ErrorCode, ScriptError } from '../errors.js'
import { type DeprecationInfo, getDeprecationManager } from '../versioning/deprecation-manager.js'
import { getVersionManager, type VersionInfo } from '../versioning/script-version.js'

/**
 * Migration step types
 */
export type MigrationStepType = 'manual' | 'automated' | 'validation'

/**
 * Migration step severity levels
 */
export type MigrationSeverity = 'critical' | 'high' | 'medium' | 'low'

/**
 * Individual migration step
 */
export interface MigrationStep {
  id: string
  title: string
  type: MigrationStepType
  severity: MigrationSeverity
  description: string
  reason?: string
  notes?: string[]
  codeExampleBefore?: string
  codeExampleAfter?: string
  automation?: () => Promise<void>
  validation?: () => Promise<{ valid: boolean; message?: string }>
}

/**
 * Migration plan structure
 */
export interface MigrationPlan {
  scriptName: string
  fromVersion: string
  toVersion: string
  isBreakingChange: boolean
  estimatedDuration: string
  generatedAt: Date
  prerequisites: string[]
  steps: MigrationStep[]
  postMigrationTasks: string[]
}

/**
 * Migration execution result
 */
export interface MigrationResult {
  success: boolean
  stepsCompleted: number
  totalSteps: number
  errors: string[]
  warnings: string[]
  manualStepsRemaining: Array<{
    title: string
    description: string
    severity: MigrationSeverity
    notes?: string[]
  }>
  validationResults: Array<{
    step: string
    passed: boolean
    message?: string
  }>
}

/**
 * Version comparison result
 */
export interface VersionComparison {
  scriptName: string
  fromVersion: VersionInfo
  toVersion: VersionInfo
  breakingChanges: Array<{
    type: string
    what: string
    why: string
    migration: string
  }>
  newFeatures: string[]
  deprecations: DeprecationInfo[]
  changelog: string[]
}

/**
 * Migration Helper class for managing script version migrations
 */
export class MigrationHelper {
  constructor(
    _db: PGlite,
    private projectRoot: string,
  ) {}

  async initialize(): Promise<void> {
    // No additional tables needed - uses existing version and deprecation tables
  }

  /**
   * Generate a comprehensive migration plan
   */
  async generateMigrationPlan(
    scriptName: string,
    fromVersion: string,
    toVersion: string,
  ): Promise<MigrationPlan> {
    const versionManager = await getVersionManager(this.projectRoot)

    const from = await versionManager.getVersion(scriptName, fromVersion)
    const to = await versionManager.getVersion(scriptName, toVersion)

    if (!from) {
      throw new ScriptError(`Version not found: ${scriptName}@${fromVersion}`, ErrorCode.NOT_FOUND)
    }

    if (!to) {
      throw new ScriptError(`Version not found: ${scriptName}@${toVersion}`, ErrorCode.NOT_FOUND)
    }

    // Generate migration steps
    const steps = await this.generateMigrationSteps(scriptName, from, to)

    // Determine if breaking change
    const isBreakingChange = (to.breakingChanges?.length ?? 0) > 0

    // Estimate duration based on steps
    const criticalSteps = steps.filter((s) => s.severity === 'critical').length
    const highSteps = steps.filter((s) => s.severity === 'high').length
    const mediumSteps = steps.filter((s) => s.severity === 'medium').length

    let estimatedMinutes = criticalSteps * 30 + highSteps * 15 + mediumSteps * 5
    estimatedMinutes = Math.max(estimatedMinutes, 5) // Minimum 5 minutes

    const estimatedDuration =
      estimatedMinutes >= 60
        ? `${Math.round(estimatedMinutes / 60)} hour${estimatedMinutes >= 120 ? 's' : ''}`
        : `${estimatedMinutes} minutes`

    // Build prerequisites
    const prerequisites: string[] = []

    if (to.requiredDependencies && Object.keys(to.requiredDependencies).length > 0) {
      prerequisites.push('Install required dependencies:')
      for (const [pkg, version] of Object.entries(to.requiredDependencies)) {
        prerequisites.push(`  - ${pkg}@${version}`)
      }
    }

    if (isBreakingChange) {
      prerequisites.push('Create a backup of your current setup')
      prerequisites.push('Review breaking changes documentation')
    }

    // Post-migration tasks
    const postMigrationTasks = [
      'Run tests to verify migration',
      'Update documentation',
      'Review changelog for additional changes',
    ]

    return {
      scriptName,
      fromVersion,
      toVersion,
      isBreakingChange,
      estimatedDuration,
      generatedAt: new Date(),
      prerequisites,
      steps,
      postMigrationTasks,
    }
  }

  /**
   * Generate migration steps from version comparison
   */
  private async generateMigrationSteps(
    scriptName: string,
    _from: VersionInfo,
    to: VersionInfo,
  ): Promise<MigrationStep[]> {
    const steps: MigrationStep[] = []
    let stepCounter = 1

    // Check for required dependencies
    if (to.requiredDependencies && Object.keys(to.requiredDependencies).length > 0) {
      const deps = Object.entries(to.requiredDependencies)
        .map(([pkg, version]) => `${pkg}@${version}`)
        .join(', ')

      steps.push({
        id: `step-${stepCounter++}`,
        title: 'Install required dependencies',
        type: 'validation',
        severity: 'critical',
        description: `Ensure the following dependencies are installed: ${deps}`,
        validation: async () => {
          // Placeholder - in real implementation would check package.json
          return { valid: true }
        },
      })
    }

    // Parse breaking changes
    if (to.breakingChanges && to.breakingChanges.length > 0) {
      for (const change of to.breakingChanges) {
        const parsed = this.parseBreakingChange(change)

        steps.push({
          id: `step-${stepCounter++}`,
          title: `Migrate: ${parsed.what}`,
          type: parsed.type === 'removed' ? 'manual' : 'automated',
          severity: this.getBreakingChangeSeverity(parsed.type),
          description: parsed.migration,
          reason: parsed.why,
          notes: [
            `Reason: ${parsed.why}`,
            parsed.type === 'removed'
              ? `This ${parsed.what} was removed in ${to.version}`
              : undefined,
          ].filter(Boolean) as string[],
        })
      }
    }

    // Check for deprecations that were removed
    const deprecationManager = await getDeprecationManager(this.projectRoot)
    const deprecations = await deprecationManager.getDeprecations(scriptName)

    for (const deprecation of deprecations) {
      // Check if this deprecation's removal version matches the target version
      if (deprecation.removalVersion === to.version) {
        steps.push({
          id: `step-${stepCounter++}`,
          title: `Handle removed ${deprecation.feature}`,
          type: 'manual',
          severity: deprecation.severity === 'error' ? 'critical' : 'high',
          description: `${deprecation.feature} was removed in ${to.version}`,
          reason: deprecation.reason,
          notes: [
            deprecation.alternative ? `Use ${deprecation.alternative} instead` : undefined,
          ].filter(Boolean) as string[],
        })
      }
    }

    // Always add final validation step
    steps.push({
      id: `step-${stepCounter++}`,
      title: 'Validate migration',
      type: 'validation',
      severity: 'high',
      description: 'Run tests and verify everything works correctly',
      validation: async () => {
        // Placeholder - in real implementation would run tests
        return { valid: true, message: 'Manual verification required' }
      },
    })

    return steps
  }

  /**
   * Parse breaking change string
   * Format: "type: what | why | migration"
   */
  private parseBreakingChange(change: string): {
    type: string
    what: string
    why: string
    migration: string
  } {
    const match = change.match(/^([^:]+):\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*(.+)$/)

    if (!match) {
      return {
        type: 'changed',
        what: change,
        why: 'See changelog',
        migration: 'Update your code accordingly',
      }
    }

    return {
      type: match[1].trim().toLowerCase(),
      what: match[2].trim(),
      why: match[3].trim(),
      migration: match[4].trim(),
    }
  }

  /**
   * Get severity for breaking change type
   */
  private getBreakingChangeSeverity(type: string): MigrationSeverity {
    switch (type.toLowerCase()) {
      case 'removed':
        return 'critical'
      case 'changed-signature':
        return 'high'
      case 'renamed':
        return 'medium'
      case 'changed-behavior':
        return 'high'
      case 'moved':
        return 'medium'
      default:
        return 'medium'
    }
  }

  /**
   * Execute a migration plan
   */
  async executeMigration(plan: MigrationPlan, dryRun = false): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: true,
      stepsCompleted: 0,
      totalSteps: plan.steps.length,
      errors: [],
      warnings: [],
      manualStepsRemaining: [],
      validationResults: [],
    }

    for (const step of plan.steps) {
      try {
        if (step.type === 'automated' && step.automation && !dryRun) {
          // Execute automated step
          await step.automation()
          result.stepsCompleted++
        } else if (step.type === 'validation' && step.validation) {
          // Execute validation
          const validationResult = await step.validation()
          result.validationResults.push({
            step: step.title,
            passed: validationResult.valid,
            message: validationResult.message,
          })

          if (!validationResult.valid) {
            result.errors.push(`Validation failed: ${step.title} - ${validationResult.message}`)
            result.success = false
          } else {
            result.stepsCompleted++
          }
        } else if (step.type === 'manual') {
          // Add to manual steps
          result.manualStepsRemaining.push({
            title: step.title,
            description: step.description,
            severity: step.severity,
            notes: step.notes,
          })
          result.warnings.push(`Manual step required: ${step.title}`)
        } else {
          // Skip in dry-run or no automation defined
          result.stepsCompleted++
        }
      } catch (error) {
        result.errors.push(`Failed to execute step "${step.title}": ${error}`)
        result.success = false
      }
    }

    return result
  }

  /**
   * Compare two versions
   */
  async compareVersions(
    scriptName: string,
    fromVersion: string,
    toVersion: string,
  ): Promise<VersionComparison> {
    const versionManager = await getVersionManager(this.projectRoot)
    const deprecationManager = await getDeprecationManager(this.projectRoot)

    const from = await versionManager.getVersion(scriptName, fromVersion)
    const to = await versionManager.getVersion(scriptName, toVersion)

    if (!from) {
      throw new ScriptError(`Version not found: ${scriptName}@${fromVersion}`, ErrorCode.NOT_FOUND)
    }

    if (!to) {
      throw new ScriptError(`Version not found: ${scriptName}@${toVersion}`, ErrorCode.NOT_FOUND)
    }

    // Parse breaking changes
    const breakingChanges = (to.breakingChanges || []).map((change) => {
      const parsed = this.parseBreakingChange(change)
      return {
        type: this.capitalizeFirst(parsed.type),
        what: parsed.what,
        why: parsed.why,
        migration: parsed.migration,
      }
    })

    // Extract new features from changelog (simplified)
    const changelog = to.changelog ? to.changelog.split('\n').filter(Boolean) : []
    const newFeatures = changelog.filter(
      (line) => !breakingChanges.some((bc) => line.includes(bc.what)),
    )

    // Get deprecations for this version
    const deprecations = await deprecationManager.getDeprecationsByVersion(scriptName, toVersion)

    return {
      scriptName,
      fromVersion: from,
      toVersion: to,
      breakingChanges,
      newFeatures,
      deprecations,
      changelog,
    }
  }

  /**
   * Generate a migration checklist
   */
  async generateChecklist(plan: MigrationPlan): Promise<string> {
    const lines: string[] = []

    lines.push(`Migration Checklist: ${plan.scriptName} ${plan.fromVersion} → ${plan.toVersion}`)
    lines.push('')

    if (plan.prerequisites.length > 0) {
      lines.push('Prerequisites:')
      for (const prereq of plan.prerequisites) {
        lines.push(`  [ ] ${prereq}`)
      }
      lines.push('')
    }

    lines.push('Migration Steps:')
    for (const step of plan.steps) {
      const severityIcon = this.getSeverityIcon(step.severity)
      lines.push(`  [ ] ${severityIcon} ${step.title}`)
      lines.push(`      ${step.description}`)
      if (step.notes && step.notes.length > 0) {
        for (const note of step.notes) {
          lines.push(`      • ${note}`)
        }
      }
      lines.push('')
    }

    if (plan.postMigrationTasks.length > 0) {
      lines.push('Post-Migration:')
      for (const task of plan.postMigrationTasks) {
        lines.push(`  [ ] ${task}`)
      }
    }

    return lines.join('\n')
  }

  /**
   * Get severity icon for display
   */
  private getSeverityIcon(severity: MigrationSeverity): string {
    switch (severity) {
      case 'critical':
        return '🚨'
      case 'high':
        return '⚠️ '
      case 'medium':
        return '⚠️ '
      case 'low':
        return 'ℹ️ '
      default:
        return '•'
    }
  }

  /**
   * Capitalize first letter
   */
  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1)
  }

  /**
   * Detect usage patterns (placeholder for future AST analysis)
   */
  async detectUsagePatterns(
    _scriptName: string,
    _feature: string,
  ): Promise<Array<{ file: string; line: number; code: string }>> {
    // Placeholder for future implementation using AST analysis
    // Would scan codebase for usage of deprecated features
    return []
  }

  /**
   * Auto-migrate patterns (placeholder for future code transformation)
   */
  async autoMigratePatterns(
    _patterns: Array<{ file: string; line: number; code: string }>,
    _transformation: (code: string) => string,
  ): Promise<void> {
    // Placeholder for future implementation
    // Would apply code transformations automatically
  }
}

let migrationHelperInstance: MigrationHelper | null = null

export async function getMigrationHelper(projectRoot: string): Promise<MigrationHelper> {
  if (!migrationHelperInstance) {
    const dataDir = join(projectRoot, '.revealui')
    const dbPath = join(dataDir, 'script-management.db')

    const db = new PGlite(dbPath)
    migrationHelperInstance = new MigrationHelper(db, projectRoot)
    await migrationHelperInstance.initialize()
  }

  return migrationHelperInstance
}
