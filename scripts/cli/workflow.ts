#!/usr/bin/env tsx
/**
 * Workflow CLI
 *
 * Unified entry point for workflow operations.
 *
 * Usage:
 *   pnpm workflow:start   <name>    # Start a new workflow
 *   pnpm workflow:status  [id]      # Show workflow status
 *   pnpm workflow:approve <token>   # Approve a pending step
 *   pnpm workflow:resume  <id>      # Resume a paused workflow
 *   pnpm workflow:cancel  <id>      # Cancel a workflow
 *   pnpm workflow:list              # List all workflows
 */

import {
  createLogger,
  SQLiteStateAdapter,
  WorkflowStateMachine,
} from '../lib/index.js'

const logger = createLogger({ prefix: 'Workflow' })

async function main() {
  const command = process.argv[2]

  if (!command || command === '--help' || command === '-h') {
    showHelp()
    return
  }

  const machine = new WorkflowStateMachine({
    adapter: new SQLiteStateAdapter(),
  })

  await machine.initialize()

  try {
    switch (command) {
      case 'start':
        await startWorkflow(machine)
        break
      case 'status':
        await showStatus(machine)
        break
      case 'approve':
        await approveStep(machine)
        break
      case 'resume':
        await resumeWorkflow(machine)
        break
      case 'cancel':
        await cancelWorkflow(machine)
        break
      case 'list':
        await listWorkflows(machine)
        break
      default:
        logger.error(`Unknown command: ${command}`)
        showHelp()
        process.exit(1)
    }
  } finally {
    await machine.close()
  }
}

async function startWorkflow(machine: WorkflowStateMachine) {
  const name = process.argv[3]
  if (!name) {
    logger.error('Workflow name required')
    logger.info('Usage: pnpm workflow:start <name>')
    process.exit(1)
  }

  const workflow = await machine.create(name, [])
  await machine.transition(workflow.id, { type: 'START' })

  logger.success(`Workflow started: ${workflow.id}`)
  logger.info(`Name: ${name}`)
}

async function showStatus(machine: WorkflowStateMachine) {
  const id = process.argv[3]

  if (id) {
    const workflow = await machine.load(id)
    if (!workflow) {
      logger.error(`Workflow not found: ${id}`)
      process.exit(1)
    }

    logger.header(`Workflow: ${workflow.name}`)
    logger.info(`ID: ${workflow.id}`)
    logger.info(`Status: ${workflow.status}`)
    logger.info(`Steps: ${workflow.currentStepIndex}/${workflow.steps.length}`)
    logger.info(`Created: ${workflow.createdAt.toISOString()}`)
    logger.info(`Updated: ${workflow.updatedAt.toISOString()}`)

    if (workflow.error) {
      logger.error(`Error: ${workflow.error}`)
    }

    // Show pending approvals
    const approvals = await machine.getPendingApprovals(workflow.id)
    if (approvals.length > 0) {
      logger.divider()
      logger.info('Pending Approvals:')
      for (const approval of approvals) {
        logger.info(`  - Step: ${approval.stepId}`)
        logger.info(`    Token: ${approval.token}`)
        logger.info(`    Expires: ${approval.expiresAt.toISOString()}`)
      }
    }
  } else {
    // Show summary of all workflows
    const workflows = await machine.list({ limit: 10 })

    if (workflows.length === 0) {
      logger.info('No workflows found')
      return
    }

    logger.header('Recent Workflows')
    for (const workflow of workflows) {
      const statusIcon =
        workflow.status === 'completed' ? '[OK]' :
        workflow.status === 'failed' ? '[FAIL]' :
        workflow.status === 'paused' ? '[PAUSED]' :
        workflow.status === 'running' ? '[RUN]' : '[...]'

      logger.info(`${statusIcon} ${workflow.id} - ${workflow.name} (${workflow.status})`)
    }
  }
}

async function approveStep(machine: WorkflowStateMachine) {
  const token = process.argv[3]
  if (!token) {
    logger.error('Approval token required')
    logger.info('Usage: pnpm workflow:approve <token> [--approve|--reject]')
    process.exit(1)
  }

  const approved = !process.argv.includes('--reject')
  const comment = process.argv.find((a) => a.startsWith('--comment='))?.split('=')[1]

  await machine.submitApproval(token, approved, undefined, comment)

  if (approved) {
    logger.success('Approval granted')
  } else {
    logger.warn('Approval denied')
  }
}

async function resumeWorkflow(machine: WorkflowStateMachine) {
  const id = process.argv[3]
  if (!id) {
    logger.error('Workflow ID required')
    logger.info('Usage: pnpm workflow:resume <id>')
    process.exit(1)
  }

  const workflow = await machine.load(id)
  if (!workflow) {
    logger.error(`Workflow not found: ${id}`)
    process.exit(1)
  }

  if (workflow.status !== 'paused') {
    logger.error(`Workflow is not paused (status: ${workflow.status})`)
    process.exit(1)
  }

  await machine.transition(id, { type: 'RESUME' })
  logger.success(`Workflow resumed: ${id}`)
}

async function cancelWorkflow(machine: WorkflowStateMachine) {
  const id = process.argv[3]
  if (!id) {
    logger.error('Workflow ID required')
    logger.info('Usage: pnpm workflow:cancel <id>')
    process.exit(1)
  }

  const workflow = await machine.load(id)
  if (!workflow) {
    logger.error(`Workflow not found: ${id}`)
    process.exit(1)
  }

  await machine.transition(id, { type: 'CANCEL' })
  logger.success(`Workflow cancelled: ${id}`)
}

async function listWorkflows(machine: WorkflowStateMachine) {
  const status = process.argv.find((a) => a.startsWith('--status='))?.split('=')[1] as
    | 'pending'
    | 'running'
    | 'paused'
    | 'completed'
    | 'failed'
    | undefined

  const workflows = await machine.list({ status, limit: 50 })

  if (workflows.length === 0) {
    logger.info('No workflows found')
    return
  }

  logger.header(`Workflows${status ? ` (${status})` : ''}`)

  for (const workflow of workflows) {
    const statusIcon =
      workflow.status === 'completed' ? '[OK]' :
      workflow.status === 'failed' ? '[FAIL]' :
      workflow.status === 'paused' ? '[PAUSE]' :
      workflow.status === 'running' ? '[RUN]' : '[...]'

    console.log(`${statusIcon} ${workflow.id}`)
    console.log(`    Name: ${workflow.name}`)
    console.log(`    Status: ${workflow.status}`)
    console.log(`    Progress: ${workflow.currentStepIndex}/${workflow.steps.length} steps`)
    console.log(`    Updated: ${workflow.updatedAt.toISOString()}`)
    console.log()
  }
}

function showHelp() {
  console.log(`
Workflow CLI

Usage:
  pnpm workflow:<command> [options]

Commands:
  start   <name>      Start a new workflow
  status  [id]        Show workflow status (or summary if no ID)
  approve <token>     Approve or reject a pending step
  resume  <id>        Resume a paused workflow
  cancel  <id>        Cancel a workflow
  list                List all workflows

Options:
  --approve           Approve the step (default)
  --reject            Reject the step
  --comment=<text>    Add a comment to the approval
  --status=<status>   Filter list by status

Examples:
  pnpm workflow:start "Database Migration"
  pnpm workflow:status wf-123456
  pnpm workflow:approve abc123def456 --approve
  pnpm workflow:approve abc123def456 --reject --comment="Not ready"
  pnpm workflow:resume wf-123456
  pnpm workflow:list --status=paused
`)
}

main().catch((error) => {
  logger.error(error.message)
  process.exit(1)
})
