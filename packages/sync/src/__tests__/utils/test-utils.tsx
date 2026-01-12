/**
 * Test Utilities for React Hook Testing
 *
 * Provides utilities for testing hooks with React Testing Library
 */

import { waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { vi } from 'vitest'
import type { ElectricClientConfig } from '../../client'
import { ElectricProvider } from '../../provider/ElectricProvider'

/**
 * Create a mock ElectricSQL config for testing
 */
export function createMockElectricConfig(
  overrides?: Partial<ElectricClientConfig>,
): ElectricClientConfig {
  return {
    serviceUrl: 'http://localhost:5133',
    authToken: 'test-token',
    debug: false,
    ...overrides,
  }
}

/**
 * Mock useShape hook from @electric-sql/react
 */
export function mockUseShape(mockData: unknown[] = [], mockError: Error | null = null) {
  const mockUseShape = vi.fn(() => ({
    data: mockData,
    isLoading: false,
    error: mockError,
    isError: mockError !== null,
  }))

  vi.mock('@electric-sql/react', () => ({
    useShape: mockUseShape,
  }))

  return mockUseShape
}

/**
 * Mock fetch for RevealUI API calls
 */
export function mockRevealUIAPI(mockResponses: Record<string, unknown> = {}) {
  const originalFetch = global.fetch

  global.fetch = vi.fn((url: string | URL, options?: RequestInit) => {
    const urlString = typeof url === 'string' ? url : url.toString()
    const method = options?.method || 'GET'

    // Find matching mock response - try both full URL and path
    const mockKey = `${method} ${urlString}`
    const pathOnly = urlString.replace(/^https?:\/\/[^/]+/, '')
    const pathKey = `${method} ${pathOnly}`

    const mockResponse =
      mockResponses[mockKey] ||
      mockResponses[pathKey] ||
      mockResponses[urlString] ||
      mockResponses[pathOnly]

    if (mockResponse) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
        headers: new Headers(),
      } as Response)
    }

    // Default success response
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => '{}',
      headers: new Headers(),
    } as Response)
  })

  return {
    restore: () => {
      global.fetch = originalFetch
    },
  }
}

/**
 * Wrapper component for testing hooks that need ElectricProvider
 */
export function createWrapper(config?: Partial<ElectricClientConfig>) {
  const electricConfig = { ...createMockElectricConfig(), ...config }

  return ({ children }: { children: ReactNode }) => (
    <ElectricProvider
      serviceUrl={electricConfig.serviceUrl}
      authToken={electricConfig.authToken}
      debug={electricConfig.debug}
    >
      {children}
    </ElectricProvider>
  )
}

/**
 * Wait for hook to finish loading
 */
export async function waitForHook<T>(
  result: { current: T },
  condition: (value: T) => boolean = (value) => !(value as { isLoading?: boolean }).isLoading,
) {
  await waitFor(() => {
    expect(condition(result.current)).toBe(true)
  })
}
