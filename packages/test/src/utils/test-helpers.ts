/**
 * Shared test utilities and helpers
 *
 * These utilities can be used across all test types (unit, integration, E2E)
 */

/**
 * Wait for a condition to be true with timeout
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 100,
): Promise<void> {
  const startTime = Date.now()

  while (Date.now() - startTime < timeout) {
    const result = await condition()
    if (result) {
      return
    }
    await new Promise((resolve) => setTimeout(resolve, interval))
  }

  throw new Error(`Condition not met within ${timeout}ms`)
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  initialDelay = 100,
): Promise<T> {
  let lastError: unknown

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (attempt < maxRetries - 1) {
        const delay = initialDelay * 2 ** attempt
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

/**
 * Create a unique test identifier
 */
export function createTestId(prefix = 'test'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Assert that a value is defined (not null or undefined)
 */
export function assertDefined<T>(
  value: T | null | undefined,
  message?: string,
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message || 'Value is null or undefined')
  }
}

/**
 * Create a mock function that tracks calls
 *
 * Note: For Vitest, prefer using vi.fn() directly from vitest
 * This helper is provided for convenience
 */
export function createMockFn<T extends (...args: unknown[]) => unknown>(
  implementation?: T,
): {
  (...args: Parameters<T>): ReturnType<T>
  calls: Array<Parameters<T>>
  results: Array<ReturnType<T>>
} {
  const calls: Array<Parameters<T>> = []
  const results: Array<ReturnType<T>> = []

  const mockFn = ((...args: Parameters<T>) => {
    calls.push(args)
    const result = implementation ? implementation(...args) : undefined
    results.push(result as ReturnType<T>)
    return result
  }) as {
    (...args: Parameters<T>): ReturnType<T>
    calls: Array<Parameters<T>>
    results: Array<ReturnType<T>>
  }

  mockFn.calls = calls
  mockFn.results = results

  return mockFn
}

/**
 * Deep clone an object for testing
 *
 * Re-exported from @revealui/core for consistency
 */
export { deepClone } from '@revealui/core/utils/deep-clone'

/**
 * Check if two values are deeply equal
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true
  }

  if (a === null || b === null || a === undefined || b === undefined) {
    return false
  }

  if (typeof a !== typeof b) {
    return false
  }

  if (typeof a !== 'object') {
    return false
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false
    }
    return a.every((item, index) => deepEqual(item, b[index]))
  }

  if (Array.isArray(a) || Array.isArray(b)) {
    return false
  }

  const keysA = Object.keys(a)
  const keysB = Object.keys(b)

  if (keysA.length !== keysB.length) {
    return false
  }

  return keysA.every((key) =>
    deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
  )
}
