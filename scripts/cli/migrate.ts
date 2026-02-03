import { ErrorCode, ScriptError } from '../lib/errors.js'
import { getMigrationHelper } from '../lib/migration/migration-helper.js'
import { BaseCLI, type CommandDefinition, runCLI } from './_base.js'

class MigrateCLI extends BaseCLI {
  name = 'migrate'
  description = 'Migration assistance for script version upgrades'

  defineCommands(): CommandDefinition[] {
    return [
      {
        name: 'plan',
        description: 'Generate migration plan between versions',
        args: [
          {
            name: 'script',
            type: 'string',
            required: true,
            description: 'Script name',
          },
          {
            name: 'from',
            type: 'string',
            required: true,
            description: 'Current version',
          },
          {
            name: 'to',
            type: 'string',
            required: true,
            description: 'Target version',
          },
        ],
        handler: async () => {
          await this.generatePlan()
          return undefined
        },
      },
      {
        name: 'execute',
        description: 'Execute migration plan',
        args: [
          {
            name: 'script',
            type: 'string',
            required: true,
            description: 'Script name',
          },
          {
            name: 'from',
            type: 'string',
            required: true,
            description: 'Current version',
          },
          {
            name: 'to',
            type: 'string',
            required: true,
            description: 'Target version',
          },
          {
            name: 'dry-run',
            type: 'boolean',
            description: 'Simulate migration without making changes',
          },
        ],
        handler: async () => {
          await this.executeMigration()
          return undefined
        },
      },
      {
        name: 'compare',
        description: 'Compare two versions',
        args: [
          {
            name: 'script',
            type: 'string',
            required: true,
            description: 'Script name',
          },
          {
            name: 'from',
            type: 'string',
            required: true,
            description: 'First version',
          },
          {
            name: 'to',
            type: 'string',
            required: true,
            description: 'Second version',
          },
        ],
        handler: async () => {
          await this.compareVersions()
          return undefined
        },
      },
      {
        name: 'checklist',
        description: 'Generate migration checklist',
        args: [
          {
            name: 'script',
            type: 'string',
            required: true,
            description: 'Script name',
          },
          {
            name: 'from',
            type: 'string',
            required: true,
            description: 'Current version',
          },
          {
            name: 'to',
            type: 'string',
            required: true,
            description: 'Target version',
          },
        ],
        handler: async () => {
          await this.generateChecklist()
          return undefined
        },
      },
    ]
  }

  private async generatePlan(): Promise<void> {
    const scriptName = this.getFlag('script', '')
    const fromVersion = this.getFlag('from', '')
    const toVersion = this.getFlag('to', '')

    if (!scriptName || !fromVersion || !toVersion) {
      throw new ScriptError(
        'Missing required arguments: --script, --from, --to',
        ErrorCode.VALIDATION_ERROR,
      )
    }

    const helper = await getMigrationHelper(this.projectRoot)
    const plan = await helper.generateMigrationPlan(scriptName, fromVersion, toVersion)

    if (this.args.flags.json) {
      this.output.success({
        plan,
      })
      return
    }

    // Human-readable output
    const logger = this.output.getLogger()

    logger.info(`\n📋 Migration Plan: ${plan.scriptName} ${plan.fromVersion} → ${plan.toVersion}\n`)

    if (plan.isBreakingChange) {
      logger.warning('⚠️  This migration includes BREAKING CHANGES\n')
    }

    logger.info(`Estimated duration: ${plan.estimatedDuration}\n`)

    if (plan.prerequisites.length > 0) {
      logger.info('Prerequisites:')
      for (const prereq of plan.prerequisites) {
        logger.info(`  ${prereq}`)
      }
      logger.info('')
    }

    logger.info(`Migration Steps (${plan.steps.length}):\n`)

    for (const step of plan.steps) {
      const typeIcon = {
        automated: '🤖',
        manual: '👤',
        validation: '✅',
      }[step.type]

      logger.info(`  ${typeIcon} ${step.title}`)
      logger.info(
        `     Type: ${this.capitalizeFirst(step.type)} (${this.getTypeDescription(step.type)})`,
      )
      logger.info(`     ${step.description}`)

      if (step.notes && step.notes.length > 0) {
        for (const note of step.notes) {
          logger.info(`     • ${note}`)
        }
      }

      logger.info('')
    }

    if (plan.postMigrationTasks.length > 0) {
      logger.info('Post-Migration Tasks:')
      for (const task of plan.postMigrationTasks) {
        logger.info(`  • ${task}`)
      }
      logger.info('')
    }
  }

  private async executeMigration(): Promise<void> {
    const scriptName = this.getFlag('script', '')
    const fromVersion = this.getFlag('from', '')
    const toVersion = this.getFlag('to', '')
    const dryRun = this.getFlag('dry-run', false)

    if (!scriptName || !fromVersion || !toVersion) {
      throw new ScriptError(
        'Missing required arguments: --script, --from, --to',
        ErrorCode.VALIDATION_ERROR,
      )
    }

    const helper = await getMigrationHelper(this.projectRoot)
    const plan = await helper.generateMigrationPlan(scriptName, fromVersion, toVersion)

    if (dryRun) {
      this.output.getLogger().info('\n🔍 DRY RUN - No changes will be made\n')
    }

    // Execute migration
    const result = await helper.executeMigration(plan, dryRun)

    if (this.args.flags.json) {
      this.output.success({
        result,
        plan,
      })
      return
    }

    // Human-readable output
    const logger = this.output.getLogger()

    logger.info(
      `\n🚀 Migration Execution: ${plan.scriptName} ${plan.fromVersion} → ${plan.toVersion}\n`,
    )

    if (result.success) {
      logger.success(`✓ Migration completed successfully\n`)
    } else {
      logger.error(`✗ Migration failed\n`)
    }

    logger.info(`Progress: ${result.stepsCompleted}/${result.totalSteps} steps completed\n`)

    if (result.errors.length > 0) {
      logger.error(`Errors (${result.errors.length}):\n`)
      for (const error of result.errors) {
        logger.error(`  • ${error}`)
      }
      logger.info('')
    }

    if (result.warnings.length > 0) {
      logger.warning(`Warnings (${result.warnings.length}):\n`)
      for (const warning of result.warnings) {
        logger.warning(`  • ${warning}`)
      }
      logger.info('')
    }

    if (result.manualStepsRemaining.length > 0) {
      logger.info(`Manual Steps Remaining (${result.manualStepsRemaining.length}):\n`)
      for (const step of result.manualStepsRemaining) {
        const severityIcon = {
          critical: '🚨',
          high: '⚠️ ',
          medium: '⚠️ ',
          low: 'ℹ️ ',
        }[step.severity]

        logger.info(`  ${severityIcon} ${step.title}`)
        logger.info(`     ${step.description}`)

        if (step.notes && step.notes.length > 0) {
          for (const note of step.notes) {
            logger.info(`     • ${note}`)
          }
        }

        logger.info('')
      }
    }

    if (result.validationResults.length > 0) {
      logger.info(`Validation Results:\n`)
      for (const validation of result.validationResults) {
        const icon = validation.passed ? '✓' : '✗'

        if (validation.passed) {
          logger.success(`  ${icon} ${validation.step}`)
        } else {
          logger.error(`  ${icon} ${validation.step}`)
        }

        if (validation.message) {
          logger.info(`     ${validation.message}`)
        }
      }
      logger.info('')
    }

    if (!result.success) {
      throw new ScriptError('Migration failed', ErrorCode.GENERAL_ERROR, {
        errors: result.errors,
      })
    }
  }

  private async compareVersions(): Promise<void> {
    const scriptName = this.getFlag('script', '')
    const fromVersion = this.getFlag('from', '')
    const toVersion = this.getFlag('to', '')

    if (!scriptName || !fromVersion || !toVersion) {
      throw new ScriptError(
        'Missing required arguments: --script, --from, --to',
        ErrorCode.VALIDATION_ERROR,
      )
    }

    const helper = await getMigrationHelper(this.projectRoot)
    const comparison = await helper.compareVersions(scriptName, fromVersion, toVersion)

    if (this.args.flags.json) {
      this.output.success({
        comparison,
      })
      return
    }

    // Human-readable output
    const logger = this.output.getLogger()

    logger.info(
      `\n📊 Version Comparison: ${comparison.scriptName} ${fromVersion} vs ${toVersion}\n`,
    )

    if (comparison.breakingChanges.length > 0) {
      logger.error(`🚨 Breaking Changes (${comparison.breakingChanges.length}):\n`)
      for (const change of comparison.breakingChanges) {
        logger.error(`  • ${change.type}: ${change.what} | ${change.why} | ${change.migration}`)
      }
      logger.info('')
    }

    if (comparison.newFeatures.length > 0) {
      logger.info(`✨ New Features (${comparison.newFeatures.length}):\n`)
      for (const feature of comparison.newFeatures) {
        logger.info(`  • ${feature}`)
      }
      logger.info('')
    }

    if (comparison.deprecations.length > 0) {
      logger.warning(`⚠️  Deprecations (${comparison.deprecations.length}):\n`)
      for (const deprecation of comparison.deprecations) {
        logger.warning(`  • ${deprecation.feature}: ${deprecation.reason}`)
        if (deprecation.alternative) {
          logger.warning(`    Use ${deprecation.alternative} instead`)
        }
        if (deprecation.removalVersion) {
          logger.warning(`    Will be removed in ${deprecation.removalVersion}`)
        }
      }
      logger.info('')
    }

    if (comparison.changelog.length > 0) {
      logger.info(`📝 Full Changelog (${comparison.changelog.length} changes):\n`)
      for (const entry of comparison.changelog) {
        logger.info(`  • ${entry}`)
      }
    }
  }

  private async generateChecklist(): Promise<void> {
    const scriptName = this.getFlag('script', '')
    const fromVersion = this.getFlag('from', '')
    const toVersion = this.getFlag('to', '')

    if (!scriptName || !fromVersion || !toVersion) {
      throw new ScriptError(
        'Missing required arguments: --script, --from, --to',
        ErrorCode.VALIDATION_ERROR,
      )
    }

    const helper = await getMigrationHelper(this.projectRoot)
    const plan = await helper.generateMigrationPlan(scriptName, fromVersion, toVersion)
    const checklist = await helper.generateChecklist(plan)

    if (this.args.flags.json) {
      this.output.success({
        checklist: checklist.split('\n'),
      })
      return
    }

    // Human-readable output
    const logger = this.output.getLogger()

    logger.info(`\n✅ ${checklist}\n`)
  }

  private getTypeDescription(type: string): string {
    switch (type) {
      case 'automated':
        return 'can be done automatically'
      case 'manual':
        return 'requires human intervention'
      case 'validation':
        return 'automated check'
      default:
        return type
    }
  }

  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCLI(MigrateCLI)
}

export { MigrateCLI }
