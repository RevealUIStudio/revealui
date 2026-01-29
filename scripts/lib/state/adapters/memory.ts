/**
 * In-Memory State Adapter
 *
 * Provides a simple in-memory implementation for testing and development.
 * State is lost when the process exits.
 */

import type {
  ApprovalRequest,
  ApprovalStatus,
  StateAdapter,
  WorkflowState,
  WorkflowStatus,
} from '../types.js'

export class MemoryStateAdapter implements StateAdapter {
  private workflows: Map<string, WorkflowState> = new Map()
  private approvals: Map<string, ApprovalRequest> = new Map()

  async initialize(): Promise<void> {
    // No initialization needed for in-memory storage
  }

  async close(): Promise<void> {
    // Clear all data
    this.workflows.clear()
    this.approvals.clear()
  }

  async saveWorkflow(workflow: WorkflowState): Promise<void> {
    // Deep clone to avoid mutations
    const cloned = this.cloneWorkflow(workflow)
    this.workflows.set(workflow.id, cloned)
  }

  async loadWorkflow(id: string): Promise<WorkflowState | null> {
    const workflow = this.workflows.get(id)
    return workflow ? this.cloneWorkflow(workflow) : null
  }

  async listWorkflows(options?: {
    status?: WorkflowStatus
    limit?: number
  }): Promise<WorkflowState[]> {
    let workflows = Array.from(this.workflows.values())

    if (options?.status) {
      workflows = workflows.filter((w) => w.status === options.status)
    }

    // Sort by updatedAt descending (most recent first)
    workflows.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())

    if (options?.limit) {
      workflows = workflows.slice(0, options.limit)
    }

    return workflows.map((w) => this.cloneWorkflow(w))
  }

  async deleteWorkflow(id: string): Promise<boolean> {
    const existed = this.workflows.has(id)
    this.workflows.delete(id)

    // Also delete related approvals
    for (const [token, approval] of this.approvals) {
      if (approval.workflowId === id) {
        this.approvals.delete(token)
      }
    }

    return existed
  }

  async saveApproval(approval: ApprovalRequest): Promise<void> {
    this.approvals.set(approval.token, { ...approval })
  }

  async loadApproval(token: string): Promise<ApprovalRequest | null> {
    const approval = this.approvals.get(token)
    return approval ? { ...approval } : null
  }

  async loadApprovalsByWorkflow(workflowId: string): Promise<ApprovalRequest[]> {
    return Array.from(this.approvals.values())
      .filter((a) => a.workflowId === workflowId)
      .map((a) => ({ ...a }))
  }

  async updateApprovalStatus(
    token: string,
    status: ApprovalStatus,
    respondedBy?: string,
    comment?: string,
  ): Promise<void> {
    const approval = this.approvals.get(token)
    if (!approval) {
      throw new Error(`Approval not found: ${token}`)
    }

    approval.status = status
    approval.respondedAt = new Date()
    if (respondedBy) approval.respondedBy = respondedBy
    if (comment) approval.comment = comment
  }

  private cloneWorkflow(workflow: WorkflowState): WorkflowState {
    return {
      ...workflow,
      steps: [...workflow.steps],
      stepStates: new Map(workflow.stepStates),
      createdAt: new Date(workflow.createdAt),
      updatedAt: new Date(workflow.updatedAt),
      completedAt: workflow.completedAt ? new Date(workflow.completedAt) : undefined,
      metadata: workflow.metadata ? { ...workflow.metadata } : undefined,
    }
  }

  /**
   * Utility method to clear all data (useful for testing)
   */
  clear(): void {
    this.workflows.clear()
    this.approvals.clear()
  }

  /**
   * Get count of stored workflows (useful for testing)
   */
  getWorkflowCount(): number {
    return this.workflows.size
  }

  /**
   * Get count of stored approvals (useful for testing)
   */
  getApprovalCount(): number {
    return this.approvals.size
  }
}
