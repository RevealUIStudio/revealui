/**
 * Test Setup
 *
 * Provides test fixtures and utilities for script tests.
 */

import { beforeAll, afterAll, afterEach } from 'vitest'
import { MemoryStateAdapter } from '../lib/state/adapters/memory.js'
import { WorkflowStateMachine } from '../lib/state/workflow-state.js'

// Global test state adapter
let testAdapter: MemoryStateAdapter | null = null
let testMachine: WorkflowStateMachine | null = null

/**
 * Gets the test state adapter (creates one if needed).
 */
export function getTestAdapter(): MemoryStateAdapter {
  if (!testAdapter) {
    testAdapter = new MemoryStateAdapter()
  }
  return testAdapter
}

/**
 * Gets the test state machine (creates one if needed).
 */
export async function getTestMachine(): Promise<WorkflowStateMachine> {
  if (!testMachine) {
    testMachine = new WorkflowStateMachine({
      adapter: getTestAdapter(),
    })
    await testMachine.initialize()
  }
  return testMachine
}

/**
 * Cleans up test resources.
 */
export async function cleanup(): Promise<void> {
  if (testMachine) {
    await testMachine.close()
    testMachine = null
  }
  if (testAdapter) {
    testAdapter.clear()
    testAdapter = null
  }
}

/**
 * Creates a test workflow for testing.
 */
export async function createTestWorkflow(
  name = 'test-workflow',
  steps = [
    { id: 'step-1', name: 'Step 1', description: 'First step', requiresApproval: false },
    { id: 'step-2', name: 'Step 2', description: 'Second step', requiresApproval: true },
  ],
) {
  const machine = await getTestMachine()
  return machine.create(name, steps)
}

// Setup/teardown hooks
beforeAll(async () => {
  // Initialize test environment
})

afterEach(() => {
  // Clear state between tests
  if (testAdapter) {
    testAdapter.clear()
  }
})

afterAll(async () => {
  await cleanup()
})
