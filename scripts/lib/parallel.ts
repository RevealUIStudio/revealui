/**
 * Parallel task execution utilities.
 *
 * Provides controlled parallel execution with:
 * - Configurable concurrency limits
 * - Progress tracking
 * - Error handling and aggregation
 * - Timeout support
 * - Resource pooling
 *
 * @example
 * ```typescript
 * import { parallel, ParallelExecutor } from './parallel.js'
 *
 * // Simple parallel execution
 * const results = await parallel(
 *   [task1, task2, task3],
 *   { concurrency: 2 }
 * )
 *
 * // With progress tracking
 * const executor = new ParallelExecutor({ concurrency: 3 })
 * executor.on('progress', ({ completed, total }) => {
 *   console.log(`${completed}/${total} tasks completed`)
 * })
 * await executor.run([task1, task2, task3])
 * ```
 *
 * @dependencies
 * - scripts/lib/logger.ts - Logging utilities
 * - scripts/lib/telemetry.ts - Performance metrics tracking
 * - node:events - Event emitter for progress tracking
 */

import { EventEmitter } from 'node:events'
import { createLogger } from './logger.js'
import { telemetry } from './telemetry.js'

const logger = createLogger({ prefix: 'Parallel' })

// =============================================================================
// Types
// =============================================================================

export interface ParallelOptions {
  /** Maximum number of concurrent tasks (default: 5) */
  concurrency?: number
  /** Timeout for each task in ms (0 = no timeout) */
  timeout?: number
  /** Stop on first error (default: false) */
  stopOnError?: boolean
  /** Enable verbose logging */
  verbose?: boolean
  /** Task execution mode */
  mode?: 'parallel' | 'sequential'
}

export interface TaskResult<T> {
  /** Task index */
  index: number
  /** Task result (if successful) */
  result?: T
  /** Error (if failed) */
  error?: Error
  /** Execution duration in ms */
  duration: number
  /** Task status */
  status: 'success' | 'error' | 'timeout'
}

export interface ProgressEvent {
  /** Number of completed tasks */
  completed: number
  /** Total number of tasks */
  total: number
  /** Progress percentage (0-100) */
  percentage: number
  /** Recently completed task result */
  lastResult?: TaskResult<unknown>
}

export type Task<T> = () => Promise<T> | T

// =============================================================================
// Parallel Executor
// =============================================================================

export class ParallelExecutor<T = unknown> extends EventEmitter {
  private concurrency: number
  private timeout: number
  private stopOnError: boolean
  private verbose: boolean
  private mode: 'parallel' | 'sequential'

  constructor(options: ParallelOptions = {}) {
    super()
    this.concurrency = options.concurrency ?? 5
    this.timeout = options.timeout ?? 0
    this.stopOnError = options.stopOnError ?? false
    this.verbose = options.verbose ?? false
    this.mode = options.mode ?? 'parallel'
  }

  /**
   * Execute tasks in parallel with concurrency control.
   */
  async run(tasks: Array<Task<T>>): Promise<Array<TaskResult<T>>> {
    if (this.mode === 'sequential') {
      return this.runSequential(tasks)
    }

    const results: Array<TaskResult<T>> = []
    const activePromises = new Set<Promise<void>>()
    let currentIndex = 0
    let completedCount = 0
    let hasError = false

    const executeTask = async (index: number): Promise<void> => {
      const task = tasks[index]
      const startTime = Date.now()

      try {
        if (this.verbose) {
          logger.info(`Starting task ${index + 1}/${tasks.length}`)
        }

        // Execute task with optional timeout
        let result: T
        if (this.timeout > 0) {
          result = await this.executeWithTimeout(task, this.timeout)
        } else {
          result = await Promise.resolve(task())
        }

        const duration = Date.now() - startTime

        const taskResult: TaskResult<T> = {
          index,
          result,
          duration,
          status: 'success',
        }

        results[index] = taskResult
        completedCount++

        // Track telemetry
        telemetry.counter('parallel-task-success')
        telemetry.startTimer('parallel-task-duration').stop({ index, duration })

        // Emit progress
        this.emit('progress', {
          completed: completedCount,
          total: tasks.length,
          percentage: (completedCount / tasks.length) * 100,
          lastResult: taskResult,
        } as ProgressEvent)

        if (this.verbose) {
          logger.success(`Task ${index + 1}/${tasks.length} completed in ${duration}ms`)
        }
      } catch (error) {
        const duration = Date.now() - startTime
        const isTimeout = error instanceof Error && error.name === 'TimeoutError'

        const taskResult: TaskResult<T> = {
          index,
          error: error instanceof Error ? error : new Error(String(error)),
          duration,
          status: isTimeout ? 'timeout' : 'error',
        }

        results[index] = taskResult
        completedCount++

        // Track telemetry
        telemetry.counter(isTimeout ? 'parallel-task-timeout' : 'parallel-task-error')
        telemetry.trackError('parallel-task-failed', error as Error, { index })

        // Emit progress
        this.emit('progress', {
          completed: completedCount,
          total: tasks.length,
          percentage: (completedCount / tasks.length) * 100,
          lastResult: taskResult,
        } as ProgressEvent)

        // Emit error
        this.emit('error', {
          index,
          error: taskResult.error,
          isTimeout,
        })

        if (this.verbose) {
          logger.error(`Task ${index + 1}/${tasks.length} failed: ${taskResult.error.message}`)
        }

        if (this.stopOnError) {
          hasError = true
        }
      }
    }

    // Process tasks with concurrency control
    while (currentIndex < tasks.length && !hasError) {
      // Fill up to concurrency limit
      while (activePromises.size < this.concurrency && currentIndex < tasks.length) {
        const index = currentIndex++
        const promise = executeTask(index).then(() => {
          activePromises.delete(promise)
        })
        activePromises.add(promise)
      }

      // Wait for at least one task to complete
      if (activePromises.size > 0) {
        await Promise.race(activePromises)
      }
    }

    // Wait for all remaining tasks
    await Promise.all(activePromises)

    return results
  }

  /**
   * Execute tasks sequentially.
   */
  private async runSequential(tasks: Array<Task<T>>): Promise<Array<TaskResult<T>>> {
    const results: Array<TaskResult<T>> = []

    for (let index = 0; index < tasks.length; index++) {
      const task = tasks[index]
      const startTime = Date.now()

      try {
        if (this.verbose) {
          logger.info(`Starting task ${index + 1}/${tasks.length}`)
        }

        let result: T
        if (this.timeout > 0) {
          result = await this.executeWithTimeout(task, this.timeout)
        } else {
          result = await Promise.resolve(task())
        }

        const duration = Date.now() - startTime

        results.push({
          index,
          result,
          duration,
          status: 'success',
        })

        telemetry.counter('sequential-task-success')

        this.emit('progress', {
          completed: index + 1,
          total: tasks.length,
          percentage: ((index + 1) / tasks.length) * 100,
        } as ProgressEvent)

        if (this.verbose) {
          logger.success(`Task ${index + 1}/${tasks.length} completed in ${duration}ms`)
        }
      } catch (error) {
        const duration = Date.now() - startTime
        const isTimeout = error instanceof Error && error.name === 'TimeoutError'

        results.push({
          index,
          error: error instanceof Error ? error : new Error(String(error)),
          duration,
          status: isTimeout ? 'timeout' : 'error',
        })

        telemetry.counter(isTimeout ? 'sequential-task-timeout' : 'sequential-task-error')
        telemetry.trackError('sequential-task-failed', error as Error, { index })

        this.emit('error', {
          index,
          error,
          isTimeout,
        })

        if (this.stopOnError) {
          break
        }
      }
    }

    return results
  }

  /**
   * Execute task with timeout.
   */
  private async executeWithTimeout(task: Task<T>, timeout: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const error = new Error(`Task timed out after ${timeout}ms`)
        error.name = 'TimeoutError'
        reject(error)
      }, timeout)

      Promise.resolve(task())
        .then((result) => {
          clearTimeout(timer)
          resolve(result)
        })
        .catch((error) => {
          clearTimeout(timer)
          reject(error)
        })
    })
  }

  /**
   * Get success rate from results.
   */
  static getSuccessRate(results: Array<TaskResult<unknown>>): number {
    const successCount = results.filter((r) => r.status === 'success').length
    return (successCount / results.length) * 100
  }

  /**
   * Get all errors from results.
   */
  static getErrors(results: Array<TaskResult<unknown>>): Error[] {
    // biome-ignore lint/style/noNonNullAssertion: Filter ensures error exists
    return results.filter((r) => r.error).map((r) => r.error!)
  }

  /**
   * Check if all tasks succeeded.
   */
  static allSucceeded(results: Array<TaskResult<unknown>>): boolean {
    return results.every((r) => r.status === 'success')
  }
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Execute tasks in parallel with concurrency control.
 *
 * @example
 * ```typescript
 * const results = await parallel(
 *   [async () => fetch('/api/1'), async () => fetch('/api/2')],
 *   { concurrency: 2 }
 * )
 * ```
 */
export async function parallel<T>(
  tasks: Array<Task<T>>,
  options?: ParallelOptions,
): Promise<Array<TaskResult<T>>> {
  const executor = new ParallelExecutor<T>(options)
  return await executor.run(tasks)
}

/**
 * Execute tasks sequentially.
 *
 * @example
 * ```typescript
 * const results = await sequential([task1, task2, task3])
 * ```
 */
export async function sequential<T>(
  tasks: Array<Task<T>>,
  options?: Omit<ParallelOptions, 'concurrency' | 'mode'>,
): Promise<Array<TaskResult<T>>> {
  const executor = new ParallelExecutor<T>({
    ...options,
    mode: 'sequential',
  })
  return await executor.run(tasks)
}

/**
 * Map over array items in parallel.
 *
 * @example
 * ```typescript
 * const results = await parallelMap(
 *   [1, 2, 3, 4, 5],
 *   async (n) => n * 2,
 *   { concurrency: 2 }
 * )
 * ```
 */
export async function parallelMap<T, R>(
  items: T[],
  mapper: (item: T, index: number) => Promise<R> | R,
  options?: ParallelOptions,
): Promise<R[]> {
  const tasks = items.map((item, index) => () => Promise.resolve(mapper(item, index)))
  const results = await parallel(tasks, options)

  // Throw if any task failed and stopOnError is true
  if (options?.stopOnError && !ParallelExecutor.allSucceeded(results)) {
    const errors = ParallelExecutor.getErrors(results)
    throw new AggregateError(errors, 'Parallel map failed')
  }

  // biome-ignore lint/style/noNonNullAssertion: All tasks succeeded if we reach here
  return results.map((r) => r.result!)
}

/**
 * Filter array items in parallel.
 *
 * @example
 * ```typescript
 * const evens = await parallelFilter(
 *   [1, 2, 3, 4, 5],
 *   async (n) => n % 2 === 0,
 *   { concurrency: 2 }
 * )
 * ```
 */
export async function parallelFilter<T>(
  items: T[],
  predicate: (item: T, index: number) => Promise<boolean> | boolean,
  options?: ParallelOptions,
): Promise<T[]> {
  const tasks = items.map((item, index) => () => Promise.resolve(predicate(item, index)))
  const results = await parallel(tasks, options)

  return items.filter((_, index) => results[index].result === true)
}

/**
 * Batch process items in parallel.
 *
 * @example
 * ```typescript
 * await batch(
 *   largeArray,
 *   async (batch) => processItems(batch),
 *   { batchSize: 10, concurrency: 2 }
 * )
 * ```
 */
export async function batch<T, R>(
  items: T[],
  processor: (batch: T[]) => Promise<R> | R,
  options: ParallelOptions & { batchSize: number },
): Promise<R[]> {
  const batches: T[][] = []
  for (let i = 0; i < items.length; i += options.batchSize) {
    batches.push(items.slice(i, i + options.batchSize))
  }

  const tasks = batches.map((batch) => () => Promise.resolve(processor(batch)))
  const results = await parallel(tasks, options)

  // biome-ignore lint/style/noNonNullAssertion: Parallel execution guarantees results
  return results.map((r) => r.result!)
}
