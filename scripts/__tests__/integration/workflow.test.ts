/**
 * Workflow State Machine Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MemoryStateAdapter } from '../../lib/state/adapters/memory.js'
import { WorkflowStateMachine } from '../../lib/state/workflow-state.js'
import type { WorkflowStep } from '../../lib/state/types.js'

describe('WorkflowStateMachine', () => {
  let adapter: MemoryStateAdapter
  let machine: WorkflowStateMachine

  const testSteps: WorkflowStep[] = [
    { id: 'step-1', name: 'Step 1', description: 'First step', requiresApproval: false },
    { id: 'step-2', name: 'Step 2', description: 'Second step', requiresApproval: true },
    { id: 'step-3', name: 'Step 3', description: 'Third step', requiresApproval: false },
  ]

  beforeEach(async () => {
    adapter = new MemoryStateAdapter()
    machine = new WorkflowStateMachine({ adapter })
    await machine.initialize()
  })

  afterEach(async () => {
    await machine.close()
    adapter.clear()
  })

  describe('create', () => {
    it('should create a workflow with pending status', async () => {
      const workflow = await machine.create('test-workflow', testSteps)

      expect(workflow.id).toBeDefined()
      expect(workflow.name).toBe('test-workflow')
      expect(workflow.status).toBe('pending')
      expect(workflow.steps).toHaveLength(3)
      expect(workflow.currentStepIndex).toBe(0)
    })

    it('should initialize step states for all steps', async () => {
      const workflow = await machine.create('test-workflow', testSteps)

      expect(workflow.stepStates.size).toBe(3)
      for (const step of testSteps) {
        const state = workflow.stepStates.get(step.id)
        expect(state).toBeDefined()
        expect(state?.status).toBe('pending')
        expect(state?.retryCount).toBe(0)
      }
    })

    it('should persist the workflow', async () => {
      const workflow = await machine.create('test-workflow', testSteps)
      const loaded = await machine.load(workflow.id)

      expect(loaded).toBeDefined()
      expect(loaded?.name).toBe('test-workflow')
    })
  })

  describe('transition', () => {
    it('should start a pending workflow', async () => {
      const workflow = await machine.create('test-workflow', testSteps)
      const updated = await machine.transition(workflow.id, { type: 'START' })

      expect(updated.status).toBe('running')
    })

    it('should not start an already running workflow', async () => {
      const workflow = await machine.create('test-workflow', testSteps)
      await machine.transition(workflow.id, { type: 'START' })

      await expect(machine.transition(workflow.id, { type: 'START' })).rejects.toThrow()
    })

    it('should pause a running workflow', async () => {
      const workflow = await machine.create('test-workflow', testSteps)
      await machine.transition(workflow.id, { type: 'START' })
      const updated = await machine.transition(workflow.id, { type: 'PAUSE' })

      expect(updated.status).toBe('paused')
    })

    it('should resume a paused workflow', async () => {
      const workflow = await machine.create('test-workflow', testSteps)
      await machine.transition(workflow.id, { type: 'START' })
      await machine.transition(workflow.id, { type: 'PAUSE' })
      const updated = await machine.transition(workflow.id, { type: 'RESUME' })

      expect(updated.status).toBe('running')
    })

    it('should cancel a workflow', async () => {
      const workflow = await machine.create('test-workflow', testSteps)
      await machine.transition(workflow.id, { type: 'START' })
      const updated = await machine.transition(workflow.id, { type: 'CANCEL' })

      expect(updated.status).toBe('cancelled')
      expect(updated.completedAt).toBeDefined()
    })

    it('should mark a step as started', async () => {
      const workflow = await machine.create('test-workflow', testSteps)
      await machine.transition(workflow.id, { type: 'START' })
      const updated = await machine.transition(workflow.id, { type: 'STEP_START', stepId: 'step-1' })

      const stepState = updated.stepStates.get('step-1')
      expect(stepState?.status).toBe('running')
      expect(stepState?.startedAt).toBeDefined()
    })

    it('should mark a step as completed and advance', async () => {
      const workflow = await machine.create('test-workflow', testSteps)
      await machine.transition(workflow.id, { type: 'START' })
      await machine.transition(workflow.id, { type: 'STEP_START', stepId: 'step-1' })
      const updated = await machine.transition(workflow.id, { type: 'STEP_COMPLETE', stepId: 'step-1' })

      const stepState = updated.stepStates.get('step-1')
      expect(stepState?.status).toBe('completed')
      expect(stepState?.completedAt).toBeDefined()
      expect(updated.currentStepIndex).toBe(1)
    })

    it('should mark a step as failed and fail the workflow', async () => {
      const workflow = await machine.create('test-workflow', testSteps)
      await machine.transition(workflow.id, { type: 'START' })
      await machine.transition(workflow.id, { type: 'STEP_START', stepId: 'step-1' })
      const updated = await machine.transition(workflow.id, {
        type: 'STEP_FAIL',
        stepId: 'step-1',
        error: 'Test error',
      })

      const stepState = updated.stepStates.get('step-1')
      expect(stepState?.status).toBe('failed')
      expect(stepState?.error).toBe('Test error')
      expect(updated.status).toBe('failed')
      expect(updated.error).toBe('Test error')
    })
  })

  describe('requestApproval', () => {
    it('should create an approval request and return a token', async () => {
      const workflow = await machine.create('test-workflow', testSteps)
      await machine.transition(workflow.id, { type: 'START' })

      const token = await machine.requestApproval(workflow.id, 'step-2')

      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
      expect(token.length).toBeGreaterThan(0)
    })

    it('should pause the workflow when approval is requested', async () => {
      const workflow = await machine.create('test-workflow', testSteps)
      await machine.transition(workflow.id, { type: 'START' })

      await machine.requestApproval(workflow.id, 'step-2')
      const updated = await machine.load(workflow.id)

      expect(updated?.status).toBe('paused')
    })
  })

  describe('submitApproval', () => {
    it('should approve and resume the workflow', async () => {
      const workflow = await machine.create('test-workflow', testSteps)
      await machine.transition(workflow.id, { type: 'START' })
      const token = await machine.requestApproval(workflow.id, 'step-2')

      await machine.submitApproval(token, true)
      const updated = await machine.load(workflow.id)

      expect(updated?.status).toBe('running')
    })

    it('should reject and cancel the workflow', async () => {
      const workflow = await machine.create('test-workflow', testSteps)
      await machine.transition(workflow.id, { type: 'START' })
      const token = await machine.requestApproval(workflow.id, 'step-2')

      await machine.submitApproval(token, false, undefined, 'Rejected for testing')
      const updated = await machine.load(workflow.id)

      expect(updated?.status).toBe('cancelled')
      expect(updated?.error).toBe('Rejected for testing')
    })

    it('should not allow approving the same token twice', async () => {
      const workflow = await machine.create('test-workflow', testSteps)
      await machine.transition(workflow.id, { type: 'START' })
      const token = await machine.requestApproval(workflow.id, 'step-2')

      await machine.submitApproval(token, true)

      await expect(machine.submitApproval(token, true)).rejects.toThrow(/already processed/)
    })
  })

  describe('list', () => {
    it('should list all workflows', async () => {
      await machine.create('workflow-1', testSteps)
      await machine.create('workflow-2', testSteps)
      await machine.create('workflow-3', testSteps)

      const workflows = await machine.list()

      expect(workflows).toHaveLength(3)
    })

    it('should filter by status', async () => {
      const wf1 = await machine.create('workflow-1', testSteps)
      const wf2 = await machine.create('workflow-2', testSteps)
      await machine.create('workflow-3', testSteps)

      await machine.transition(wf1.id, { type: 'START' })
      await machine.transition(wf2.id, { type: 'START' })

      const running = await machine.list({ status: 'running' })
      const pending = await machine.list({ status: 'pending' })

      expect(running).toHaveLength(2)
      expect(pending).toHaveLength(1)
    })

    it('should limit results', async () => {
      for (let i = 0; i < 10; i++) {
        await machine.create(`workflow-${i}`, testSteps)
      }

      const workflows = await machine.list({ limit: 5 })

      expect(workflows).toHaveLength(5)
    })
  })

  describe('delete', () => {
    it('should delete a workflow', async () => {
      const workflow = await machine.create('test-workflow', testSteps)

      const deleted = await machine.delete(workflow.id)
      const loaded = await machine.load(workflow.id)

      expect(deleted).toBe(true)
      expect(loaded).toBeNull()
    })

    it('should return false for non-existent workflow', async () => {
      const deleted = await machine.delete('non-existent-id')

      expect(deleted).toBe(false)
    })
  })
})
