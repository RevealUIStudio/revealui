/**
 * Workflow State Machine
 *
 * Manages workflow state transitions with proper validation and persistence.
 * Replaces the file-based approval system with a proper state machine.
 */

import { randomBytes } from 'node:crypto'
import { ErrorCode, ScriptError } from '../errors.js'
import { MemoryStateAdapter } from './adapters/memory.js'
import type {
  ApprovalRequest,
  StateAdapter,
  WorkflowEvent,
  WorkflowState,
  WorkflowStatus,
  WorkflowStep,
  WorkflowStepState,
} from './types.js'

export interface WorkflowStateMachineOptions {
  /** State adapter to use (defaults to in-memory) */
  adapter?: StateAdapter
  /** Approval expiration time in milliseconds (default: 24 hours) */
  approvalExpirationMs?: number
}

/**
 * WorkflowStateMachine manages the lifecycle of automation workflows.
 *
 * @example
 * ```typescript
 * import { WorkflowStateMachine } from '@revealui/scripts-lib/state/workflow'
 * import { PGliteStateAdapter } from '@revealui/scripts-lib/state/adapters/pglite'
 *
 * const machine = new WorkflowStateMachine({
 *   adapter: new PGliteStateAdapter(),
 * })
 *
 * await machine.initialize()
 *
 * // Create a workflow
 * const workflow = await machine.create('db-migration', [
 *   { id: 'backup', name: 'Backup', description: 'Create backup', requiresApproval: false },
 *   { id: 'migrate', name: 'Migrate', description: 'Run migration', requiresApproval: true },
 * ])
 *
 * // Start the workflow
 * await machine.transition(workflow.id, { type: 'START' })
 * ```
 */
export class WorkflowStateMachine {
  private adapter: StateAdapter
  private approvalExpirationMs: number
  private initialized = false

  constructor(options: WorkflowStateMachineOptions = {}) {
    this.adapter = options.adapter || new MemoryStateAdapter()
    this.approvalExpirationMs = options.approvalExpirationMs || 24 * 60 * 60 * 1000 // 24 hours
  }

  /**
   * Initialize the state machine and its adapter.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return
    await this.adapter.initialize()
    this.initialized = true
  }

  /**
   * Close the state machine and clean up resources.
   */
  async close(): Promise<void> {
    await this.adapter.close()
    this.initialized = false
  }

  /**
   * Create a new workflow.
   */
  async create(name: string, steps: WorkflowStep[], description?: string): Promise<WorkflowState> {
    this.ensureInitialized()

    const workflow: WorkflowState = {
      id: this.generateId(),
      name,
      description,
      status: 'pending',
      steps,
      stepStates: new Map(),
      currentStepIndex: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    // Initialize step states
    for (const step of steps) {
      workflow.stepStates.set(step.id, {
        stepId: step.id,
        status: 'pending',
        retryCount: 0,
      })
    }

    await this.adapter.saveWorkflow(workflow)
    return workflow
  }

  /**
   * Load an existing workflow.
   */
  async load(id: string): Promise<WorkflowState | null> {
    this.ensureInitialized()
    return this.adapter.loadWorkflow(id)
  }

  /**
   * List workflows with optional filtering.
   */
  async list(options?: { status?: WorkflowStatus; limit?: number }): Promise<WorkflowState[]> {
    this.ensureInitialized()
    return this.adapter.listWorkflows(options)
  }

  /**
   * Delete a workflow.
   */
  async delete(id: string): Promise<boolean> {
    this.ensureInitialized()
    return this.adapter.deleteWorkflow(id)
  }

  /**
   * Transition a workflow to a new state based on an event.
   */
  async transition(id: string, event: WorkflowEvent): Promise<WorkflowState> {
    this.ensureInitialized()

    const workflow = await this.adapter.loadWorkflow(id)
    if (!workflow) {
      throw new ScriptError(`Workflow not found: ${id}`, ErrorCode.NOT_FOUND)
    }

    const newState = this.applyEvent(workflow, event)
    newState.updatedAt = new Date()

    await this.adapter.saveWorkflow(newState)
    return newState
  }

  /**
   * Request approval for a workflow step.
   * Returns a unique token that can be used to submit the approval.
   */
  async requestApproval(workflowId: string, stepId: string): Promise<string> {
    this.ensureInitialized()

    const workflow = await this.adapter.loadWorkflow(workflowId)
    if (!workflow) {
      throw new ScriptError(`Workflow not found: ${workflowId}`, ErrorCode.NOT_FOUND)
    }

    const step = workflow.steps.find((s) => s.id === stepId)
    if (!step) {
      throw new ScriptError(`Step not found: ${stepId}`, ErrorCode.NOT_FOUND)
    }

    const token = this.generateToken()
    const approval: ApprovalRequest = {
      id: this.generateId(),
      workflowId,
      stepId,
      token,
      status: 'pending',
      requestedAt: new Date(),
      expiresAt: new Date(Date.now() + this.approvalExpirationMs),
    }

    await this.adapter.saveApproval(approval)

    // Update workflow status
    await this.transition(workflowId, { type: 'APPROVAL_REQUEST', stepId })

    return token
  }

  /**
   * Submit an approval decision.
   */
  async submitApproval(
    token: string,
    approved: boolean,
    respondedBy?: string,
    comment?: string,
  ): Promise<void> {
    this.ensureInitialized()

    const approval = await this.adapter.loadApproval(token)
    if (!approval) {
      throw new ScriptError(`Approval not found: ${token}`, ErrorCode.NOT_FOUND)
    }

    if (approval.status !== 'pending') {
      throw new ScriptError(`Approval already processed: ${approval.status}`, ErrorCode.CONFLICT)
    }

    if (new Date() > approval.expiresAt) {
      await this.adapter.updateApprovalStatus(token, 'expired')
      throw new ScriptError('Approval has expired', ErrorCode.INVALID_STATE)
    }

    const newStatus = approved ? 'approved' : 'rejected'
    await this.adapter.updateApprovalStatus(token, newStatus, respondedBy, comment)

    // Update workflow
    const event: WorkflowEvent = approved
      ? { type: 'APPROVAL_GRANTED', stepId: approval.stepId, by: respondedBy }
      : { type: 'APPROVAL_DENIED', stepId: approval.stepId, reason: comment }

    await this.transition(approval.workflowId, event)
  }

  /**
   * Get pending approvals for a workflow.
   */
  async getPendingApprovals(workflowId: string): Promise<ApprovalRequest[]> {
    this.ensureInitialized()
    const approvals = await this.adapter.loadApprovalsByWorkflow(workflowId)
    return approvals.filter((a) => a.status === 'pending')
  }

  /**
   * Get the current step for a workflow.
   */
  getCurrentStep(workflow: WorkflowState): WorkflowStep | null {
    if (workflow.currentStepIndex >= workflow.steps.length) {
      return null
    }
    return workflow.steps[workflow.currentStepIndex]
  }

  /**
   * Get the state of a specific step.
   */
  getStepState(workflow: WorkflowState, stepId: string): WorkflowStepState | null {
    return workflow.stepStates.get(stepId) || null
  }

  /**
   * Check if a workflow can proceed to the next step.
   */
  canProceed(workflow: WorkflowState): boolean {
    if (workflow.status !== 'running') return false
    if (workflow.currentStepIndex >= workflow.steps.length) return false

    const currentStep = workflow.steps[workflow.currentStepIndex]
    const stepState = workflow.stepStates.get(currentStep.id)

    if (!stepState) return false
    if (stepState.status !== 'pending' && stepState.status !== 'completed') return false

    // Check dependencies
    if (currentStep.dependsOn) {
      for (const depId of currentStep.dependsOn) {
        const depState = workflow.stepStates.get(depId)
        if (!depState || depState.status !== 'completed') {
          return false
        }
      }
    }

    return true
  }

  private applyEvent(workflow: WorkflowState, event: WorkflowEvent): WorkflowState {
    const newState = { ...workflow, stepStates: new Map(workflow.stepStates) }

    switch (event.type) {
      case 'START':
        if (workflow.status !== 'pending') {
          throw new ScriptError(
            `Cannot start workflow in status: ${workflow.status}`,
            ErrorCode.INVALID_STATE,
          )
        }
        newState.status = 'running'
        break

      case 'PAUSE':
        if (workflow.status !== 'running') {
          throw new ScriptError(
            `Cannot pause workflow in status: ${workflow.status}`,
            ErrorCode.INVALID_STATE,
          )
        }
        newState.status = 'paused'
        break

      case 'RESUME':
        if (workflow.status !== 'paused') {
          throw new ScriptError(
            `Cannot resume workflow in status: ${workflow.status}`,
            ErrorCode.INVALID_STATE,
          )
        }
        newState.status = 'running'
        break

      case 'CANCEL':
        if (workflow.status === 'completed' || workflow.status === 'cancelled') {
          throw new ScriptError(
            `Cannot cancel workflow in status: ${workflow.status}`,
            ErrorCode.INVALID_STATE,
          )
        }
        newState.status = 'cancelled'
        newState.completedAt = new Date()
        break

      case 'STEP_START': {
        const stepState = newState.stepStates.get(event.stepId)
        if (stepState) {
          stepState.status = 'running'
          stepState.startedAt = new Date()
        }
        break
      }

      case 'STEP_COMPLETE': {
        const stepState = newState.stepStates.get(event.stepId)
        if (stepState) {
          stepState.status = 'completed'
          stepState.completedAt = new Date()
          stepState.output = event.output
        }
        // Move to next step
        newState.currentStepIndex++
        break
      }

      case 'STEP_FAIL': {
        const stepState = newState.stepStates.get(event.stepId)
        if (stepState) {
          stepState.status = 'failed'
          stepState.completedAt = new Date()
          stepState.error = event.error
        }
        newState.status = 'failed'
        newState.error = event.error
        newState.completedAt = new Date()
        break
      }

      case 'STEP_SKIP': {
        const stepState = newState.stepStates.get(event.stepId)
        if (stepState) {
          stepState.status = 'skipped'
        }
        newState.currentStepIndex++
        break
      }

      case 'APPROVAL_REQUEST':
        newState.status = 'paused'
        break

      case 'APPROVAL_GRANTED':
        newState.status = 'running'
        break

      case 'APPROVAL_DENIED':
        newState.status = 'cancelled'
        newState.error = event.reason || 'Approval denied'
        newState.completedAt = new Date()
        break

      case 'COMPLETE':
        newState.status = 'completed'
        newState.completedAt = new Date()
        break

      case 'FAIL':
        newState.status = 'failed'
        newState.error = event.error
        newState.completedAt = new Date()
        break

      default:
        throw new ScriptError(
          `Unknown event type: ${(event as WorkflowEvent).type}`,
          ErrorCode.VALIDATION_ERROR,
        )
    }

    return newState
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new ScriptError(
        'WorkflowStateMachine not initialized. Call initialize() first.',
        ErrorCode.INVALID_STATE,
      )
    }
  }

  private generateId(): string {
    return `wf-${Date.now()}-${randomBytes(4).toString('hex')}`
  }

  private generateToken(): string {
    return randomBytes(32).toString('hex')
  }
}
