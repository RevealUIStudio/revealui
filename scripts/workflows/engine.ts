#!/usr/bin/env tsx
/**
 * Automation Engine
 *
 * Core engine that manages workflow state with proper state machine
 * and persistent storage. Replaces the file-based approval system.
 */

import {
  createLogger,
  PGliteStateAdapter,
  WorkflowStateMachine,
  type WorkflowStep,
} from '../lib/index.js'
import { registerCleanupHandler, registerProcess } from '@revealui/core/monitoring'

const logger = createLogger({ prefix: 'Engine' })

export class AutomationEngine {
  private machine: WorkflowStateMachine
  private initialized = false
  private cleanupHandlerRegistered = false

  constructor() {
    this.machine = new WorkflowStateMachine({
      adapter: new PGliteStateAdapter(),
    })
  }

  async initialize(): Promise<void> {
    if (this.initialized) return
    await this.machine.initialize()
    this.initialized = true

    // Register cleanup handler on first initialization
    if (!this.cleanupHandlerRegistered) {
      registerCleanupHandler(
        'orchestration-engine',
        () => this.close(),
        'Close orchestration engine and PGlite adapter',
        95 // High priority
      )
      this.cleanupHandlerRegistered = true
    }
  }

  async close(): Promise<void> {
    if (!this.initialized) return
    await this.machine.close()
    this.initialized = false
  }

  /**
   * Request approval for a workflow step.
   * Returns a unique token that can be used to respond to the approval request.
   */
  async requestApproval(stepName: string, workflowId: string): Promise<string> {
    await this.initialize()

    logger.info(`Requesting approval for step: ${stepName}`)

    const token = await this.machine.requestApproval(workflowId, stepName)

    logger.warning(`Approval required for step: ${stepName}`)
    logger.info(`Approval token: ${token}`)
    logger.info(`To approve: pnpm workflow:approve ${token} --approve`)
    logger.info(`To reject: pnpm workflow:approve ${token} --reject`)

    return token
  }

  /**
   * Submit approval response.
   */
  async submitApproval(token: string, approved: boolean, comment?: string): Promise<void> {
    await this.initialize()

    await this.machine.submitApproval(token, approved, undefined, comment)

    if (approved) {
      logger.success('Approval granted')
    } else {
      logger.warning('Approval denied')
    }
  }

  /**
   * Create a new workflow.
   */
  async createWorkflow(name: string, steps: WorkflowStep[], description?: string) {
    await this.initialize()
    return this.machine.create(name, steps, description)
  }

  /**
   * Load an existing workflow.
   */
  async loadWorkflow(id: string) {
    await this.initialize()
    return this.machine.load(id)
  }

  /**
   * List all workflows.
   */
  async listWorkflows(options?: { status?: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'; limit?: number }) {
    await this.initialize()
    return this.machine.list(options)
  }

  /**
   * Start a workflow.
   */
  async startWorkflow(id: string) {
    await this.initialize()

    // Register workflow as a tracked process
    if (process.pid) {
      registerProcess(
        process.pid,
        'workflow',
        [id],
        'orchestration',
        { workflowId: id },
        process.ppid
      )
    }

    return this.machine.transition(id, { type: 'START' })
  }

  /**
   * Pause a workflow.
   */
  async pauseWorkflow(id: string) {
    await this.initialize()
    return this.machine.transition(id, { type: 'PAUSE' })
  }

  /**
   * Resume a paused workflow.
   */
  async resumeWorkflow(id: string) {
    await this.initialize()
    return this.machine.transition(id, { type: 'RESUME' })
  }

  /**
   * Cancel a workflow.
   */
  async cancelWorkflow(id: string) {
    await this.initialize()
    return this.machine.transition(id, { type: 'CANCEL' })
  }

  /**
   * Mark a step as started.
   */
  async startStep(workflowId: string, stepId: string) {
    await this.initialize()
    return this.machine.transition(workflowId, { type: 'STEP_START', stepId })
  }

  /**
   * Mark a step as completed.
   */
  async completeStep(workflowId: string, stepId: string, output?: string) {
    await this.initialize()
    return this.machine.transition(workflowId, { type: 'STEP_COMPLETE', stepId, output })
  }

  /**
   * Mark a step as failed.
   */
  async failStep(workflowId: string, stepId: string, error: string) {
    await this.initialize()
    return this.machine.transition(workflowId, { type: 'STEP_FAIL', stepId, error })
  }

  /**
   * Get pending approvals for a workflow.
   */
  async getPendingApprovals(workflowId: string) {
    await this.initialize()
    return this.machine.getPendingApprovals(workflowId)
  }

  /**
   * Delete a workflow.
   */
  async deleteWorkflow(id: string) {
    await this.initialize()
    return this.machine.delete(id)
  }
}

// Export singleton instance for convenience
export const engine = new AutomationEngine()
