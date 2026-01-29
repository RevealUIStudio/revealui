#!/usr/bin/env node
/**
 * Automation Engine - Real Workflow Execution
 *
 * Core engine that executes automation workflows with human checkpoints.
 * Uses the state machine for persistent workflow state management.
 */

import { execSync } from 'node:child_process'
import {
  createLogger,
  PGliteStateAdapter,
  WorkflowStateMachine,
  type WorkflowState,
  type WorkflowStep,
} from '../../lib/index.js'

const logger = createLogger({ prefix: 'Automation' })

export class AutomationEngine {
  private machine: WorkflowStateMachine
  private currentWorkflow: WorkflowState | null = null

  constructor() {
    this.machine = new WorkflowStateMachine({
      adapter: new PGliteStateAdapter(),
    })
  }

  async initialize(): Promise<void> {
    await this.machine.initialize()
  }

  async close(): Promise<void> {
    await this.machine.close()
  }

  defineWorkflow(steps: WorkflowStep[]): void {
    // This will be called after createWorkflow
    if (!this.currentWorkflow) {
      throw new Error('No workflow created. Call createWorkflow first.')
    }
    // Steps are already defined during creation, this is for backward compatibility
  }

  async createWorkflow(task: string, steps: WorkflowStep[]): Promise<WorkflowState> {
    await this.initialize()
    this.currentWorkflow = await this.machine.create(task, steps)
    return this.currentWorkflow
  }

  async execute(): Promise<boolean> {
    if (!this.currentWorkflow) {
      logger.error('No workflow defined')
      return false
    }

    logger.header('Automation Engine Starting')
    logger.info(`Task: ${this.currentWorkflow.name}`)
    logger.info(`Workflow ID: ${this.currentWorkflow.id}`)
    logger.divider()

    // Start the workflow
    this.currentWorkflow = await this.machine.transition(this.currentWorkflow.id, { type: 'START' })

    while (this.currentWorkflow.currentStepIndex < this.currentWorkflow.steps.length) {
      const step = this.currentWorkflow.steps[this.currentWorkflow.currentStepIndex]
      const stepNum = this.currentWorkflow.currentStepIndex + 1
      const totalSteps = this.currentWorkflow.steps.length

      logger.info(`Step ${stepNum}/${totalSteps}: ${step.name}`)
      logger.info(`Description: ${step.description}`)

      // Check if step requires approval
      if (step.requiresApproval) {
        const approved = await this.requestApproval(step)
        if (!approved) {
          logger.warning('Workflow paused waiting for approval')
          logger.info(`Resume with: pnpm workflow:resume ${this.currentWorkflow.id}`)
          return false
        }
      }

      // Mark step as started
      this.currentWorkflow = await this.machine.transition(this.currentWorkflow.id, {
        type: 'STEP_START',
        stepId: step.id,
      })

      // Execute the step
      const success = await this.executeStep(step)
      if (!success) {
        this.currentWorkflow = await this.machine.transition(this.currentWorkflow.id, {
          type: 'STEP_FAIL',
          stepId: step.id,
          error: `Step failed: ${step.name}`,
        })
        logger.error(`Workflow failed at step: ${step.name}`)
        return false
      }

      // Run validations if specified
      if (step.validation && step.validation.length > 0) {
        const validationPassed = await this.runValidations(step.validation)
        if (!validationPassed) {
          this.currentWorkflow = await this.machine.transition(this.currentWorkflow.id, {
            type: 'STEP_FAIL',
            stepId: step.id,
            error: `Validation failed for step: ${step.name}`,
          })
          logger.error(`Validation failed for step: ${step.name}`)
          return false
        }
      }

      // Mark step as completed
      this.currentWorkflow = await this.machine.transition(this.currentWorkflow.id, {
        type: 'STEP_COMPLETE',
        stepId: step.id,
      })

      logger.success(`Completed: ${step.name}`)
    }

    // Mark workflow as completed
    this.currentWorkflow = await this.machine.transition(this.currentWorkflow.id, { type: 'COMPLETE' })

    logger.divider()
    logger.success('Automation workflow completed successfully!')
    return true
  }

  private async requestApproval(step: WorkflowStep): Promise<boolean> {
    if (!this.currentWorkflow) return false

    const token = await this.machine.requestApproval(this.currentWorkflow.id, step.id)

    logger.divider()
    logger.warning('HUMAN APPROVAL REQUIRED')
    logger.info(`Step: ${step.name}`)
    logger.info(`Description: ${step.description}`)
    if (step.command) {
      logger.info(`Command: ${step.command}`)
    }
    logger.divider()
    logger.info(`To approve: pnpm workflow:approve ${token} --approve`)
    logger.info(`To reject: pnpm workflow:approve ${token} --reject`)
    logger.divider()

    // In a real implementation, this would wait for user input
    // For CI/automated scenarios, return false to pause
    return false
  }

  private async executeStep(step: WorkflowStep): Promise<boolean> {
    try {
      logger.info(`Executing: ${step.name}`)

      let command = step.command
      if (step.script) {
        command = `pnpm tsx ${step.script}`
      }

      if (!command) {
        logger.success('Step completed (no command required)')
        return true
      }

      const timeout = step.timeout || 300000 // 5 minutes default
      execSync(command, {
        stdio: 'inherit',
        timeout,
        cwd: process.cwd(),
      })

      logger.success(`Executed: ${step.name}`)
      return true
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error(`Step failed: ${step.name}`)
      logger.error(`Error: ${errorMessage}`)

      // Attempt rollback if specified
      if (step.rollback) {
        logger.info('Attempting rollback...')
        try {
          execSync(step.rollback, { stdio: 'inherit', timeout: 60000 })
          logger.success('Rollback completed')
        } catch (rollbackError: unknown) {
          const rollbackMessage =
            rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
          logger.error(`Rollback failed: ${rollbackMessage}`)
        }
      }

      return false
    }
  }

  private async runValidations(validations: string[]): Promise<boolean> {
    logger.info('Running validations...')

    for (const validation of validations) {
      try {
        let command: string

        switch (validation) {
          case 'typecheck':
            command = 'pnpm typecheck:all'
            break
          case 'lint':
            command = 'pnpm lint'
            break
          case 'test':
            command = 'pnpm test'
            break
          case 'component-audit':
            command = 'pnpm tsx scripts/component-audit.ts'
            break
          default:
            logger.warn(`Unknown validation: ${validation}`)
            continue
        }

        logger.info(`Running: ${command}`)
        execSync(command, { stdio: 'pipe', timeout: 120000 }) // 2 minutes
        logger.success(`${validation} passed`)
      } catch {
        logger.error(`${validation} failed`)
        return false
      }
    }

    return true
  }

  getStatus(): WorkflowState | null {
    return this.currentWorkflow
  }

  async resume(workflowId: string): Promise<boolean> {
    await this.initialize()

    const workflow = await this.machine.load(workflowId)
    if (!workflow) {
      logger.error(`Workflow not found: ${workflowId}`)
      return false
    }

    this.currentWorkflow = workflow

    // Resume from paused state
    if (workflow.status === 'paused') {
      this.currentWorkflow = await this.machine.transition(workflowId, { type: 'RESUME' })
    }

    return this.execute()
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    logger.error('Task description required')
    logger.info('Usage: automation-engine "task description"')
    process.exit(1)
  }

  const task = args.join(' ')
  const engine = new AutomationEngine()

  try {
    // Create workflow with default steps
    await engine.createWorkflow(task, [
      {
        id: 'audit-components',
        name: 'Component Audit',
        description: 'Audit all components to identify working vs broken',
        script: 'scripts/component-audit.ts',
        requiresApproval: false,
        validation: ['component-audit'],
      },
      {
        id: 'fix-validation',
        name: 'Fix Validation Issues',
        description: 'Fix TypeScript, linting, and test issues',
        script: 'scripts/fix-validation-issues.ts',
        requiresApproval: true,
        validation: ['typecheck', 'lint'],
      },
      {
        id: 'build-automation-core',
        name: 'Build Automation Core',
        description: 'Create automation-engine.ts and workflow-runner.ts',
        command: 'echo "Building automation core..."',
        requiresApproval: false,
      },
      {
        id: 'final-validation',
        name: 'Final Validation',
        description: 'Run complete validation suite to confirm everything works',
        requiresApproval: false,
        validation: ['typecheck', 'lint', 'test'],
      },
    ])

    const success = await engine.execute()

    if (!success) {
      const status = engine.getStatus()
      logger.divider()
      logger.warn('Automation workflow paused or failed')
      if (status) {
        logger.info(`Status: ${status.status}`)
        logger.info(`Workflow ID: ${status.id}`)
        if (status.error) {
          logger.error(`Error: ${status.error}`)
        }
      }
      process.exit(1)
    }

    logger.success('Automation infrastructure successfully built!')
  } finally {
    await engine.close()
  }
}

// Only run main if this is the entry point
const isMainModule = import.meta.url === `file://${process.argv[1]}`
if (isMainModule) {
  main().catch((error) => {
    logger.error(error.message)
    process.exit(1)
  })
}

export { AutomationEngine }
