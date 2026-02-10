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

export function createMockSentry(): {
  init: ReturnType<typeof vi.fn>
  captureException: ReturnType<typeof vi.fn>
  captureMessage: ReturnType<typeof vi.fn>
  addBreadcrumb: ReturnType<typeof vi.fn>
  setTag: ReturnType<typeof vi.fn>
  setUser: ReturnType<typeof vi.fn>
  setContext: ReturnType<typeof vi.fn>
  withScope: ReturnType<typeof vi.fn>
  configureScope: ReturnType<typeof vi.fn>
  getCapturedErrors: () => CapturedError[]
  clearCapturedErrors: () => void
  getBreadcrumbs: () => Array<{ message: string; category: string }>
} {
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
    withScope: vi.fn(),
    configureScope: vi.fn(),
    getCapturedErrors: () => [...capturedErrors],
    clearCapturedErrors: () => {
      capturedErrors.length = 0
      breadcrumbs.length = 0
    },
    getBreadcrumbs: () => [...breadcrumbs],
  }
}

export function getCapturedErrors(): CapturedError[] {
  return [...capturedErrors]
}

export function clearCapturedErrors(): void {
  capturedErrors.length = 0
  breadcrumbs.length = 0
}
