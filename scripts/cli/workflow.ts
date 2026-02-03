#!/usr/bin/env tsx

/**
 * Workflow CLI
 *
 * Unified entry point for workflow operations with dual-mode output support.
 *
 * Usage:
 *   pnpm workflow:start   <name>    # Start a new workflow
 *   pnpm workflow:status  [id]      # Show workflow status
 *   pnpm workflow:approve <token>   # Approve a pending step
 *   pnpm workflow:resume  <id>      # Resume a paused workflow
 *   pnpm workflow:cancel  <id>      # Cancel a workflow
 *   pnpm workflow:list              # List all workflows
 *   pnpm workflow:approvals         # List pending approvals
 *
 * Add --json flag to any command for machine-readable output.
 */

import type { ParsedArgs } from '../lib/args.js'
import { getExecutionLogger } from '../lib/audit/execution-logger.js'
import { invalidState, notFound } from '../lib/errors.js'
import {
  type ApprovalRequest,
  PGliteStateAdapter,
  type WorkflowState,
  WorkflowStateMachine,
  type WorkflowStatus,
} from '../lib/index.js'
import { ok, type ScriptOutput } from '../lib/output.js'
import { BaseCLI, type CommandDefinition, runCLI } from './_base.js'

// =============================================================================
// Types for JSON output
// =============================================================================

interface WorkflowData {
  id: string
  name: string
  status: string
  currentStepIndex: number
  totalSteps: number
  createdAt: string
  updatedAt: string
  error?: string
  pendingApprovals?: ApprovalData[]
}

interface ApprovalData {
  token: string
  stepId: string
  expiresAt: string
  workflowId?: string
}

interface WorkflowListData {
  workflows: WorkflowData[]
  count: number
  filter?: { status?: string }
}

interface ApprovalResultData {
  approved: boolean
  token: string
  comment?: string
}

// =============================================================================
// Workflow CLI
// =============================================================================

class WorkflowCLI extends BaseCLI {
  name = 'workflow'
  description = 'Manage workflows with approval gates'

  private machine!: WorkflowStateMachine
  private executionId: string | null = null
  private executionSuccess = true
  private executionError: string | undefined

  defineCommands(): CommandDefinition[] {
    return [
      {
        name: 'start',
        description: 'Start a new workflow',
        args: [],
        handler: (args) => this.start(args),
      },
      {
        name: 'status',
        description: 'Show workflow status (or summary if no ID)',
        args: [],
        handler: (args) => this.status(args),
      },
      {
        name: 'approve',
        description: 'Approve or reject a pending step',
        args: [
          { name: 'reject', type: 'boolean', description: 'Reject the step' },
          { name: 'comment', type: 'string', description: 'Add a comment' },
        ],
        handler: (args) => this.approve(args),
      },
      {
        name: 'resume',
        description: 'Resume a paused workflow',
        args: [],
        handler: (args) => this.resume(args),
      },
      {
        name: 'cancel',
        description: 'Cancel a workflow',
        confirmPrompt: 'Are you sure you want to cancel this workflow?',
        args: [],
        handler: (args) => this.cancel(args),
      },
      {
        name: 'list',
        description: 'List all workflows',
        args: [
          {
            name: 'status',
            short: 's',
            type: 'string',
            description: 'Filter by status (pending, running, paused, completed, failed)',
          },
          {
            name: 'limit',
            short: 'l',
            type: 'number',
            default: 50,
            description: 'Maximum number of workflows to return',
          },
        ],
        handler: (args) => this.list(args),
      },
      {
        name: 'approvals',
        description: 'List pending approvals',
        args: [{ name: 'pending', type: 'boolean', description: 'Show only pending approvals' }],
        handler: (args) => this.approvals(args),
      },
      {
        name: 'delete',
        description: 'Delete a workflow',
        confirmPrompt: 'Are you sure you want to delete this workflow? This cannot be undone.',
        args: [],
        handler: (args) => this.delete(args),
      },
    ]
  }

  /**
   * Lifecycle hook: called before command execution
   * Handles both execution logging and workflow machine initialization
   */
  async beforeRun(): Promise<void> {
    // Start execution logging
    const logger = await getExecutionLogger()
    this.executionId = await logger.startExecution({
      scriptName: this.name,
      command: this.args.command || 'unknown',
      args: this.args.positional,
    })

    // Initialize workflow state machine
    this.machine = new WorkflowStateMachine({
      adapter: new PGliteStateAdapter(),
    })
    await this.machine.initialize()
  }

  /**
   * Lifecycle hook: called after command execution
   * Handles both execution logging and workflow machine cleanup
   */
  async afterRun(): Promise<void> {
    // Close workflow state machine
    await this.machine.close()

    // End execution logging
    if (this.executionId) {
      const logger = await getExecutionLogger()
      await logger.endExecution(this.executionId, {
        success: this.executionSuccess,
        error: this.executionError,
      })
    }
  }

  // ===========================================================================
  // Commands
  // ===========================================================================

  private async start(_args: ParsedArgs): Promise<ScriptOutput<WorkflowData>> {
    const name = this.requirePositional(0, 'workflow name')

    const workflow = await this.machine.create(name, [])
    await this.machine.transition(workflow.id, { type: 'START' })

    const data = this.formatWorkflow(workflow)

    this.output.progress(`Workflow started: ${workflow.id}`)
    return ok(data)
  }

  private async status(_args: ParsedArgs): Promise<ScriptOutput<WorkflowData | WorkflowListData>> {
    const id = this.getPositional(0)

    if (id) {
      // Single workflow status
      const workflow = await this.machine.load(id)
      if (!workflow) {
        throw notFound('Workflow', id)
      }

      const approvals = await this.machine.getPendingApprovals(workflow.id)
      const data = this.formatWorkflow(workflow, approvals)

      // Human-mode additional output
      if (!this.output.isJsonMode()) {
        this.output.header(`Workflow: ${workflow.name}`)
        this.output.progress(`ID: ${workflow.id}`)
        this.output.progress(`Status: ${workflow.status}`)
        this.output.progress(`Steps: ${workflow.currentStepIndex}/${workflow.steps.length}`)
        this.output.progress(`Created: ${workflow.createdAt.toISOString()}`)
        this.output.progress(`Updated: ${workflow.updatedAt.toISOString()}`)

        if (workflow.error) {
          this.output.warn(`Error: ${workflow.error}`)
        }

        if (approvals.length > 0) {
          this.output.divider()
          this.output.progress('Pending Approvals:')
          for (const approval of approvals) {
            this.output.progress(`  - Step: ${approval.stepId}`)
            this.output.progress(`    Token: ${approval.token}`)
            this.output.progress(`    Expires: ${approval.expiresAt.toISOString()}`)
          }
        }
      }

      return ok(data)
    } else {
      // List recent workflows
      const workflows = await this.machine.list({ limit: 10 })

      const data: WorkflowListData = {
        workflows: workflows.map((w) => this.formatWorkflow(w)),
        count: workflows.length,
      }

      // Human-mode output
      if (!this.output.isJsonMode()) {
        if (workflows.length === 0) {
          this.output.progress('No workflows found')
        } else {
          this.output.header('Recent Workflows')
          for (const workflow of workflows) {
            const icon = this.getStatusIcon(workflow.status)
            this.output.progress(`${icon} ${workflow.id} - ${workflow.name} (${workflow.status})`)
          }
        }
      }

      return ok(data)
    }
  }

  private async approve(_args: ParsedArgs): Promise<ScriptOutput<ApprovalResultData>> {
    const token = this.requirePositional(0, 'approval token')
    const rejected = this.getFlag('reject', false)
    const comment = this.getFlag<string | undefined>('comment', undefined)
    const approved = !rejected

    await this.machine.submitApproval(token, approved, undefined, comment)

    const data: ApprovalResultData = {
      approved,
      token,
      ...(comment && { comment }),
    }

    this.output.progress(approved ? 'Approval granted' : 'Approval denied')
    return ok(data)
  }

  private async resume(_args: ParsedArgs): Promise<ScriptOutput<WorkflowData>> {
    const id = this.requirePositional(0, 'workflow ID')

    const workflow = await this.machine.load(id)
    if (!workflow) {
      throw notFound('Workflow', id)
    }

    if (workflow.status !== 'paused') {
      throw invalidState('resume', workflow.status, ['paused'])
    }

    await this.machine.transition(id, { type: 'RESUME' })

    // Reload to get updated state
    const updated = await this.machine.load(id)
    const data = this.formatWorkflow(updated!)

    this.output.progress(`Workflow resumed: ${id}`)
    return ok(data)
  }

  private async cancel(_args: ParsedArgs): Promise<ScriptOutput<WorkflowData>> {
    const id = this.requirePositional(0, 'workflow ID')

    const workflow = await this.machine.load(id)
    if (!workflow) {
      throw notFound('Workflow', id)
    }

    await this.machine.transition(id, { type: 'CANCEL' })

    // Reload to get updated state
    const updated = await this.machine.load(id)
    const data = this.formatWorkflow(updated!)

    this.output.progress(`Workflow cancelled: ${id}`)
    return ok(data)
  }

  private async list(_args: ParsedArgs): Promise<ScriptOutput<WorkflowListData>> {
    const status = this.getFlag<string | undefined>('status', undefined) as
      | WorkflowStatus
      | undefined
    const limit = this.getFlag('limit', 50)

    const workflows = await this.machine.list({ status, limit })

    const data: WorkflowListData = {
      workflows: workflows.map((w) => this.formatWorkflow(w)),
      count: workflows.length,
      ...(status && { filter: { status } }),
    }

    // Human-mode output
    if (!this.output.isJsonMode()) {
      if (workflows.length === 0) {
        this.output.progress('No workflows found')
      } else {
        this.output.header(`Workflows${status ? ` (${status})` : ''}`)
        for (const workflow of workflows) {
          const icon = this.getStatusIcon(workflow.status)
          console.log(`${icon} ${workflow.id}`)
          console.log(`    Name: ${workflow.name}`)
          console.log(`    Status: ${workflow.status}`)
          console.log(`    Progress: ${workflow.currentStepIndex}/${workflow.steps.length} steps`)
          console.log(`    Updated: ${workflow.updatedAt.toISOString()}`)
          console.log()
        }
      }
    }

    return ok(data)
  }

  private async approvals(_args: ParsedArgs): Promise<ScriptOutput<{ approvals: ApprovalData[] }>> {
    const workflowId = this.getPositional(0)

    // Get all workflows and their approvals
    const workflows = await this.machine.list({ limit: 100 })
    const allApprovals: ApprovalData[] = []

    for (const workflow of workflows) {
      if (workflowId && workflow.id !== workflowId) continue

      const approvals = await this.machine.getPendingApprovals(workflow.id)
      for (const approval of approvals) {
        allApprovals.push({
          token: approval.token,
          stepId: approval.stepId,
          expiresAt: approval.expiresAt.toISOString(),
          workflowId: workflow.id,
        })
      }
    }

    // Human-mode output
    if (!this.output.isJsonMode()) {
      if (allApprovals.length === 0) {
        this.output.progress('No pending approvals')
      } else {
        this.output.header('Pending Approvals')
        for (const approval of allApprovals) {
          console.log(`Token: ${approval.token}`)
          console.log(`  Workflow: ${approval.workflowId}`)
          console.log(`  Step: ${approval.stepId}`)
          console.log(`  Expires: ${approval.expiresAt}`)
          console.log()
        }
      }
    }

    return ok({ approvals: allApprovals }, { count: allApprovals.length })
  }

  private async delete(_args: ParsedArgs): Promise<ScriptOutput<{ deleted: string }>> {
    const id = this.requirePositional(0, 'workflow ID')

    const workflow = await this.machine.load(id)
    if (!workflow) {
      throw notFound('Workflow', id)
    }

    await this.machine.delete(id)

    this.output.progress(`Workflow deleted: ${id}`)
    return ok({ deleted: id })
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  private formatWorkflow(workflow: WorkflowState, approvals?: ApprovalRequest[]): WorkflowData {
    const data: WorkflowData = {
      id: workflow.id,
      name: workflow.name,
      status: workflow.status,
      currentStepIndex: workflow.currentStepIndex,
      totalSteps: workflow.steps.length,
      createdAt: workflow.createdAt.toISOString(),
      updatedAt: workflow.updatedAt.toISOString(),
    }

    if (workflow.error) {
      data.error = workflow.error
    }

    if (approvals && approvals.length > 0) {
      data.pendingApprovals = approvals.map((a) => ({
        token: a.token,
        stepId: a.stepId,
        expiresAt: a.expiresAt.toISOString(),
      }))
    }

    return data
  }

  private getStatusIcon(status: string): string {
    switch (status) {
      case 'completed':
        return '[OK]'
      case 'failed':
        return '[FAIL]'
      case 'paused':
        return '[PAUSE]'
      case 'running':
        return '[RUN]'
      case 'cancelled':
        return '[CANCEL]'
      default:
        return '[...]'
    }
  }
}

// =============================================================================
// Entry Point
// =============================================================================

runCLI(WorkflowCLI)
