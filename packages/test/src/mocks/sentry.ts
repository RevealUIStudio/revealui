import { vi } from 'vitest'

export interface CapturedError {
  error: Error
  context: Record<string, unknown>
  breadcrumbs: Array<{ message: string; category: string }>
  tags: Record<string, string>
  level: string
}

const capturedErrors: CapturedError[] = []
const breadcrumbs: Array<{ message: string; category: string }> = []

export function createMockSentry() {
  return {
    init: vi.fn(),
    captureException: vi.fn((error: Error, context?: Record<string, unknown>) => {
      capturedErrors.push({
        error,
        context: context || {},
        breadcrumbs: [...breadcrumbs],
        tags: {},
        level: 'error',
      })
      return 'mock-event-id'
    }),
    captureMessage: vi.fn(),
    addBreadcrumb: vi.fn((crumb: { message: string; category: string }) => {
      breadcrumbs.push(crumb)
    }),
    setTag: vi.fn(),
    setUser: vi.fn(),
    setContext: vi.fn(),
  }
}

export function getCapturedErrors(): CapturedError[] {
  return [...capturedErrors]
}

export function clearCapturedErrors(): void {
  capturedErrors.length = 0
  breadcrumbs.length = 0
}
