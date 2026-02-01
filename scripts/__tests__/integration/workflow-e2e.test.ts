/**
 * Workflow End-to-End Integration Tests
 *
 * Tests complete workflow lifecycle: creation, execution, approval, and completion.
 * Uses the MemoryStateAdapter for isolated testing.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MemoryStateAdapter } from '../../lib/state/adapters/memory.js'
import { WorkflowStateMachine, type WorkflowStep } from '../../lib/state/workflow-state.js'

// =============================================================================
// Test Fixtures
// =============================================================================

function createTestSteps(): WorkflowStep[] {
  return [
    {
      id: 'setup',
      name: 'Setup',
      description: 'Initial setup step',
      requiresApproval: false,
    },
    {
      id: 'build',
      name: 'Build',
      description: 'Build the project',
      requiresApproval: false,
    },
    {
      id: 'deploy-staging',
      name: 'Deploy to Staging',
      description: 'Deploy to staging environment',
      requiresApproval: true, // Requires approval before proceeding
    },
    {
      id: 'deploy-production',
      name: 'Deploy to Production',
      description: 'Deploy to production environment',
      requiresApproval: true, // Requires approval before proceeding
    },
  ]
}

// =============================================================================
// Tests
// =============================================================================

describe('Workflow E2E', () => {
  let adapter: MemoryStateAdapter
  let machine: WorkflowStateMachine

  beforeEach(async () => {
    adapter = new MemoryStateAdapter()
    machine = new WorkflowStateMachine({ adapter })
    await machine.initialize()
  })

  afterEach(async () => {
    await machine.close()
    adapter.clear()
  })

  describe('complete workflow lifecycle', () => {
    it('creates, executes, approves, and completes a workflow', async () => {
      // Step 1: Create workflow
      const workflow = await machine.create('deployment', createTestSteps())

      expect(workflow.id).toBeDefined()
      expect(workflow.name).toBe('deployment')
      expect(workflow.status).toBe('pending')
      expect(workflow.steps).toHaveLength(4)

      // Step 2: Start workflow
      await machine.transition(workflow.id, { type: 'START' })

      let state = await machine.load(workflow.id)
      expect(state?.status).toBe('running')
      expect(state?.currentStepIndex).toBe(0)

      // Step 3: Complete non-approval steps
      // Setup step (no approval needed)
      await machine.transition(workflow.id, { type: 'STEP_COMPLETE', stepId: 'setup' })

      state = await machine.load(workflow.id)
      expect(state?.currentStepIndex).toBe(1)

      // Build step (no approval needed)
      await machine.transition(workflow.id, { type: 'STEP_COMPLETE', stepId: 'build' })

      state = await machine.load(workflow.id)
      expect(state?.currentStepIndex).toBe(2)

      // Step 4: Deploy staging requires approval
      // Use requestApproval to create an approval record AND pause the workflow
      const stagingToken = await machine.requestApproval(workflow.id, 'deploy-staging')

      state = await machine.load(workflow.id)
      expect(state?.status).toBe('paused')

      // Get pending approval
      const approvals = await machine.getPendingApprovals(workflow.id)
      expect(approvals).toHaveLength(1)
      expect(approvals[0].stepId).toBe('deploy-staging')

      // Submit approval
      await machine.submitApproval(stagingToken, true)

      state = await machine.load(workflow.id)
      expect(state?.status).toBe('running')

      // Complete the staging deploy step
      await machine.transition(workflow.id, { type: 'STEP_COMPLETE', stepId: 'deploy-staging' })

      state = await machine.load(workflow.id)
      expect(state?.currentStepIndex).toBe(3)

      // Step 5: Deploy production requires approval
      const prodToken = await machine.requestApproval(workflow.id, 'deploy-production')

      const prodApprovals = await machine.getPendingApprovals(workflow.id)
      expect(prodApprovals).toHaveLength(1)

      // Approve production deployment
      await machine.submitApproval(prodToken, true, 'admin', 'LGTM')

      state = await machine.load(workflow.id)

      // Step 6: Complete workflow
      await machine.transition(workflow.id, { type: 'STEP_COMPLETE', stepId: 'deploy-production' })

      state = await machine.load(workflow.id)
      expect(state?.status).toBe('completed')
    })

    it('handles approval rejection', async () => {
      const workflow = await machine.create('deployment', createTestSteps())

      await machine.transition(workflow.id, { type: 'START' })

      // Skip to approval step
      await machine.transition(workflow.id, { type: 'STEP_COMPLETE', stepId: 'setup' })
      await machine.transition(workflow.id, { type: 'STEP_COMPLETE', stepId: 'build' })

      // Request approval (creates the approval record)
      const token = await machine.requestApproval(workflow.id, 'deploy-staging')

      // Reject the approval
      await machine.submitApproval(token, false, 'admin', 'Not ready')

      const state = await machine.load(workflow.id)
      expect(state?.status).toBe('cancelled')
      expect(state?.error).toContain('denied')
    })

    it('supports workflow cancellation', async () => {
      const workflow = await machine.create('deployment', createTestSteps())

      await machine.transition(workflow.id, { type: 'START' })
      await machine.transition(workflow.id, { type: 'STEP_START', stepId: 'setup' })

      // Cancel mid-workflow
      await machine.transition(workflow.id, { type: 'CANCEL' })

      const state = await machine.load(workflow.id)
      expect(state?.status).toBe('cancelled')
    })

    it('handles workflow failure', async () => {
      const workflow = await machine.create('deployment', createTestSteps())

      await machine.transition(workflow.id, { type: 'START' })

      // Simulate failure
      await machine.transition(workflow.id, {
        type: 'FAIL',
        error: 'Build failed: exit code 1',
      })

      const state = await machine.load(workflow.id)
      expect(state?.status).toBe('failed')
      expect(state?.error).toBe('Build failed: exit code 1')
    })
  })

  describe('workflow listing and filtering', () => {
    it('lists all workflows', async () => {
      await machine.create('workflow-1', createTestSteps())
      await machine.create('workflow-2', createTestSteps())
      await machine.create('workflow-3', createTestSteps())

      const workflows = await machine.list({ limit: 100 })
      expect(workflows.length).toBeGreaterThanOrEqual(3)
    })

    it('filters workflows by status', async () => {
      const wf1 = await machine.create('running-workflow', createTestSteps())
      const wf2 = await machine.create('pending-workflow', createTestSteps())

      await machine.transition(wf1.id, { type: 'START' })

      const runningWorkflows = await machine.list({ status: 'running' })
      const pendingWorkflows = await machine.list({ status: 'pending' })

      expect(runningWorkflows.some((w) => w.id === wf1.id)).toBe(true)
      expect(pendingWorkflows.some((w) => w.id === wf2.id)).toBe(true)
    })

    it('respects limit parameter', async () => {
      for (let i = 0; i < 5; i++) {
        await machine.create(`workflow-${i}`, createTestSteps())
      }

      const limited = await machine.list({ limit: 3 })
      expect(limited.length).toBeLessThanOrEqual(3)
    })
  })

  describe('workflow deletion', () => {
    it('deletes a workflow', async () => {
      const workflow = await machine.create('to-delete', createTestSteps())

      await machine.delete(workflow.id)

      const state = await machine.load(workflow.id)
      expect(state).toBeNull()
    })

    it('handles deletion of non-existent workflow', async () => {
      // Should not throw
      await machine.delete('non-existent-id')
    })
  })

  describe('approval expiration', () => {
    it('creates approvals with expiration time', async () => {
      const workflow = await machine.create('deployment', createTestSteps())

      await machine.transition(workflow.id, { type: 'START' })
      await machine.transition(workflow.id, { type: 'STEP_COMPLETE', stepId: 'setup' })
      await machine.transition(workflow.id, { type: 'STEP_COMPLETE', stepId: 'build' })

      // Request approval to create the record
      await machine.requestApproval(workflow.id, 'deploy-staging')

      const approvals = await machine.getPendingApprovals(workflow.id)

      expect(approvals).toHaveLength(1)
      expect(approvals[0].expiresAt).toBeDefined()
      expect(approvals[0].expiresAt.getTime()).toBeGreaterThan(Date.now())
    })
  })

  describe('concurrent workflows', () => {
    it('handles multiple concurrent workflows', async () => {
      const workflows = await Promise.all([
        machine.create('concurrent-1', createTestSteps()),
        machine.create('concurrent-2', createTestSteps()),
        machine.create('concurrent-3', createTestSteps()),
      ])

      // Start all workflows
      await Promise.all(workflows.map((w) => machine.transition(w.id, { type: 'START' })))

      // Verify all are running
      const states = await Promise.all(workflows.map((w) => machine.load(w.id)))

      for (const state of states) {
        expect(state?.status).toBe('running')
      }
    })
  })

  describe('workflow resume', () => {
    it('resumes a paused workflow via approval', async () => {
      const workflow = await machine.create('resumable', createTestSteps())

      await machine.transition(workflow.id, { type: 'START' })
      await machine.transition(workflow.id, { type: 'STEP_COMPLETE', stepId: 'setup' })
      await machine.transition(workflow.id, { type: 'STEP_COMPLETE', stepId: 'build' })

      // Request approval pauses the workflow
      const token = await machine.requestApproval(workflow.id, 'deploy-staging')

      let state = await machine.load(workflow.id)
      expect(state?.status).toBe('paused')

      // Approve to resume
      await machine.submitApproval(token, true)

      state = await machine.load(workflow.id)
      expect(state?.status).toBe('running')
    })
  })
})

describe('Workflow State Persistence', () => {
  it('persists workflow state when using same adapter instance', async () => {
    // Using a shared adapter instance allows state to persist
    const sharedAdapter = new MemoryStateAdapter()

    // Create and modify workflow with first machine instance
    const machine1 = new WorkflowStateMachine({ adapter: sharedAdapter })
    await machine1.initialize()

    const workflow = await machine1.create('persistent', createTestSteps())
    await machine1.transition(workflow.id, { type: 'START' })
    await machine1.transition(workflow.id, { type: 'STEP_COMPLETE', stepId: 'setup' })

    // Don't close - just stop using machine1
    // (closing may clear resources)

    // Load with second machine instance using SAME adapter
    const machine2 = new WorkflowStateMachine({ adapter: sharedAdapter })
    await machine2.initialize()

    const state = await machine2.load(workflow.id)

    expect(state).not.toBeNull()
    expect(state?.status).toBe('running')
    expect(state?.currentStepIndex).toBe(1)

    // Cleanup
    await machine1.close()
    await machine2.close()
  })

  it('does not persist state across different adapter instances', async () => {
    // Each adapter instance has its own storage
    const adapter1 = new MemoryStateAdapter()
    const adapter2 = new MemoryStateAdapter()

    const machine1 = new WorkflowStateMachine({ adapter: adapter1 })
    await machine1.initialize()

    const workflow = await machine1.create('isolated', createTestSteps())
    await machine1.transition(workflow.id, { type: 'START' })

    // Different adapter instance = different storage
    const machine2 = new WorkflowStateMachine({ adapter: adapter2 })
    await machine2.initialize()

    const state = await machine2.load(workflow.id)

    // Should NOT find the workflow (different adapter)
    expect(state).toBeNull()

    await machine1.close()
    await machine2.close()
  })
})
