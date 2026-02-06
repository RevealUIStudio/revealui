/**
 * Multi-step operation test helpers
 *
 * Since withTransaction() is NOT implemented (Neon HTTP driver limitation),
 * these helpers test compensating transaction patterns.
 *
 * PURPOSE: Verify that multi-step operations handle partial failures gracefully
 * without atomic transaction guarantees.
 */

export interface StepResult<T> {
  success: boolean
  data?: T
  error?: Error
  rollbackFn?: () => Promise<void>
}

export interface MultiStepResult<T> {
  results: StepResult<T>[]
  completedSteps: number
  totalSteps: number
  allSucceeded: boolean
}

export interface Step<T> {
  name: string
  execute: () => Promise<T>
  rollback: (data: T) => Promise<void>
}

/**
 * Execute a multi-step operation with tracking
 * Each step registers its own rollback function
 *
 * @param steps - Array of steps to execute
 * @returns Results with completed step count
 */
export async function executeMultiStepOperation<T>(steps: Step<T>[]): Promise<MultiStepResult<T>> {
  const results: StepResult<T>[] = []
  const rollbacks: Array<() => Promise<void>> = []

  for (const step of steps) {
    try {
      const data = await step.execute()
      results.push({ success: true, data })
      rollbacks.push(() => step.rollback(data))
    } catch (error) {
      results.push({ success: false, error: error as Error })
      // Execute rollbacks in reverse order (LIFO)
      for (const rollback of rollbacks.reverse()) {
        try {
          await rollback()
        } catch {
          // Silently ignore rollback errors - we're already in error state
          // The original error will be thrown below
        }
      }
      break
    }
  }

  return {
    results,
    completedSteps: results.filter((r) => r.success).length,
    totalSteps: steps.length,
    allSucceeded: results.every((r) => r.success),
  }
}

/**
 * Data consistency expectation
 */
export interface ConsistencyExpectation {
  table: string
  condition: Record<string, unknown>
  shouldExist: boolean
}

export interface ConsistencyResult {
  consistent: boolean
  inconsistencies: string[]
}

/**
 * Verify data consistency after partial failure
 *
 * @param db - Database adapter with query method
 * @param expectations - Array of consistency expectations
 * @returns Consistency result with inconsistencies
 */
export async function verifyDataConsistency(
  db: { query: (sql: string, params: unknown[]) => Promise<{ rows: unknown[] }> },
  expectations: ConsistencyExpectation[],
): Promise<ConsistencyResult> {
  const inconsistencies: string[] = []

  for (const exp of expectations) {
    const conditions = Object.entries(exp.condition)
      .map(([k], i) => `${k} = $${i + 1}`)
      .join(' AND ')

    const result = await db.query(
      `SELECT * FROM ${exp.table} WHERE ${conditions}`,
      Object.values(exp.condition),
    )

    const exists = result.rows.length > 0
    if (exists !== exp.shouldExist) {
      inconsistencies.push(
        `${exp.table}: expected ${exp.shouldExist ? 'exists' : 'not exists'}, got ${exists ? 'exists' : 'not exists'}`,
      )
    }
  }

  return { consistent: inconsistencies.length === 0, inconsistencies }
}

/**
 * Idempotent operation tracker for retry-safe operations
 */
const operationRegistry = new Map<string, { completed: boolean; result?: unknown }>()

/**
 * Execute an idempotent operation (retry-safe)
 *
 * @param operationId - Unique operation identifier
 * @param operation - Operation to execute
 * @returns Result with created flag
 */
export async function executeIdempotentOperation<T>(
  operationId: string,
  operation: () => Promise<T>,
): Promise<{ created: boolean; result: T }> {
  const existing = operationRegistry.get(operationId)
  if (existing?.completed) {
    return { created: false, result: existing.result as T }
  }

  const result = await operation()
  operationRegistry.set(operationId, { completed: true, result })
  return { created: true, result }
}

/**
 * Clear operation registry (for testing cleanup)
 */
export function clearOperationRegistry(): void {
  operationRegistry.clear()
}

/**
 * Simulate a multi-step operation with configurable failure point
 *
 * @param stepCount - Total number of steps
 * @param failAtStep - Step number to fail at (0 = no failure)
 * @returns Execution result
 */
export async function simulateMultiStepWithFailure(
  stepCount: number,
  failAtStep: number = 0,
): Promise<MultiStepResult<{ stepIndex: number }>> {
  const executedSteps: number[] = []
  const rolledBackSteps: number[] = []

  const steps: Step<{ stepIndex: number }>[] = []

  for (let i = 0; i < stepCount; i++) {
    steps.push({
      name: `Step ${i + 1}`,
      execute: async () => {
        if (failAtStep > 0 && i === failAtStep - 1) {
          throw new Error(`Simulated failure at step ${i + 1}`)
        }
        executedSteps.push(i)
        return { stepIndex: i }
      },
      rollback: async (data) => {
        rolledBackSteps.push(data.stepIndex)
      },
    })
  }

  return executeMultiStepOperation(steps)
}
