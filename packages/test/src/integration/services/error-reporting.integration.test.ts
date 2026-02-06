/**
 * Error Reporting System Integration Tests
 *
 * PURPOSE: Verify error reporting abstraction layer works correctly
 *
 * CRITICAL CONTEXT: Error reporting must work correctly to:
 * - Track and diagnose production issues
 * - Maintain user privacy (filtering sensitive data)
 * - Provide context through breadcrumbs
 * - Support multiple reporting backends
 *
 * TESTS:
 * - Error capture with context
 * - Breadcrumb management
 * - User context handling
 * - Error filtering and sampling
 */

import {
  type Breadcrumb,
  type ErrorReport,
  type ErrorReporter,
  ErrorReportingSystem,
  type UserContext,
} from '@revealui/core/error-handling/error-reporter'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearCapturedErrors, createMockSentry, getCapturedErrors } from '../../mocks/sentry.js'

// Create mock reporter for testing
class MockErrorReporter implements ErrorReporter {
  public capturedErrors: Array<{ error: Error; context?: Partial<ErrorReport> }> = []
  public capturedMessages: Array<{
    message: string
    level?: string
    context?: Partial<ErrorReport>
  }> = []
  public user: UserContext | null = null
  public breadcrumbs: Breadcrumb[] = []

  captureError(error: Error, context?: Partial<ErrorReport>): void {
    this.capturedErrors.push({ error, context })
  }

  captureMessage(message: string, level?: string, context?: Partial<ErrorReport>): void {
    this.capturedMessages.push({ message, level, context })
  }

  setUser(user: UserContext | null): void {
    this.user = user
  }

  setContext(_context: Record<string, unknown>): void {
    // Mock implementation
  }

  setTag(_key: string, _value: string): void {
    // Mock implementation
  }

  addBreadcrumb(breadcrumb: Breadcrumb): void {
    this.breadcrumbs.push(breadcrumb)
  }
}

describe('Error Reporting System Integration Tests', () => {
  let errorReporter: ErrorReportingSystem
  let mockReporter: MockErrorReporter

  beforeEach(() => {
    errorReporter = new ErrorReportingSystem()
    mockReporter = new MockErrorReporter()
    errorReporter.addReporter(mockReporter)
    clearCapturedErrors()
  })

  // =============================================================================
  // Error Capture
  // =============================================================================

  describe('Error Capture', () => {
    it('should capture exception with context', () => {
      const testError = new Error('Test error message')
      const context = {
        context: {
          component: 'TestComponent',
          action: 'submit',
        },
        tags: {
          severity: 'high',
        },
      }

      errorReporter.captureError(testError, context)

      expect(mockReporter.capturedErrors).toHaveLength(1)
      expect(mockReporter.capturedErrors[0]?.error.message).toBe('Test error message')
      expect(mockReporter.capturedErrors[0]?.context?.context?.component).toBe('TestComponent')
      expect(mockReporter.capturedErrors[0]?.context?.tags?.severity).toBe('high')
    })

    it('should include breadcrumbs in error reports', () => {
      // Add multiple breadcrumbs
      errorReporter.addBreadcrumb({
        timestamp: new Date().toISOString(),
        level: 'info',
        category: 'user-action',
        message: 'User clicked button',
      })

      errorReporter.addBreadcrumb({
        timestamp: new Date().toISOString(),
        level: 'info',
        category: 'navigation',
        message: 'Navigated to /profile',
      })

      errorReporter.addBreadcrumb({
        timestamp: new Date().toISOString(),
        level: 'warning',
        category: 'api',
        message: 'API call failed',
      })

      // Capture error
      const testError = new Error('Action failed')
      errorReporter.captureError(testError)

      // Verify last 10 breadcrumbs are included
      const capturedError = mockReporter.capturedErrors[0]
      expect(capturedError?.context?.extra?.breadcrumbs).toBeDefined()
      const breadcrumbs = capturedError?.context?.extra?.breadcrumbs as Breadcrumb[]
      expect(breadcrumbs).toHaveLength(3)
    })

    it('should generate fingerprint for error grouping', () => {
      // Create errors with the same message - fingerprints should be similar (contain error type and message)
      const error1 = new TypeError('Cannot read property of undefined')
      const error2 = new TypeError('Cannot read property of undefined')

      errorReporter.captureError(error1)
      errorReporter.captureError(error2)

      const fingerprint1 = mockReporter.capturedErrors[0]?.context?.fingerprint
      const fingerprint2 = mockReporter.capturedErrors[1]?.context?.fingerprint

      // Fingerprints should be defined and contain error type
      expect(fingerprint1).toBeDefined()
      expect(fingerprint2).toBeDefined()
      expect(fingerprint1).toContain('TypeError')
      expect(fingerprint2).toContain('TypeError')

      // Fingerprints should start the same (error type and message are the same)
      expect(fingerprint1?.substring(0, 20)).toBe(fingerprint2?.substring(0, 20))
    })

    it('should determine error level based on error type', () => {
      const typeError = new TypeError('Type error')
      const referenceError = new ReferenceError('Reference error')

      // Create custom error types
      class NetworkError extends Error {
        constructor(message: string) {
          super(message)
          this.name = 'NetworkError'
        }
      }
      const networkError = new NetworkError('Network error')

      errorReporter.captureError(typeError)
      errorReporter.captureError(referenceError)
      errorReporter.captureError(networkError)

      // TypeError and ReferenceError should be 'error' level
      expect(mockReporter.capturedErrors[0]?.context?.level).toBe('error')
      expect(mockReporter.capturedErrors[1]?.context?.level).toBe('error')

      // NetworkError should be 'warning' level
      expect(mockReporter.capturedErrors[2]?.context?.level).toBe('warning')
    })
  })

  // =============================================================================
  // User Context
  // =============================================================================

  describe('User Context', () => {
    it('should include user context in error reports', () => {
      const user: UserContext = {
        id: 'user_123',
        email: 'test@example.com',
        username: 'testuser',
      }

      errorReporter.setUser(user)

      const testError = new Error('User action failed')
      errorReporter.captureError(testError)

      expect(mockReporter.capturedErrors[0]?.context?.user).toEqual(user)
    })

    it('should clear user context when set to null', () => {
      // Set user first
      errorReporter.setUser({ id: 'user_123', email: 'test@example.com' })

      // Clear user
      errorReporter.setUser(null)

      const testError = new Error('Anonymous error')
      errorReporter.captureError(testError)

      expect(mockReporter.capturedErrors[0]?.context?.user).toBeUndefined()
    })
  })

  // =============================================================================
  // Breadcrumb Management
  // =============================================================================

  describe('Breadcrumb Management', () => {
    it('should limit breadcrumbs to maxBreadcrumbs (100)', () => {
      // Add 110 breadcrumbs
      for (let i = 0; i < 110; i++) {
        errorReporter.addBreadcrumb({
          timestamp: new Date().toISOString(),
          level: 'info',
          message: `Breadcrumb ${i}`,
        })
      }

      // Get breadcrumbs
      const breadcrumbs = errorReporter.getBreadcrumbs()

      // Should only keep 100
      expect(breadcrumbs).toHaveLength(100)

      // Should keep the most recent ones (10-109, not 0-99)
      expect(breadcrumbs[0]?.message).toBe('Breadcrumb 10')
      expect(breadcrumbs[99]?.message).toBe('Breadcrumb 109')
    })

    it('should clear breadcrumbs on clearBreadcrumbs()', () => {
      // Add breadcrumbs
      errorReporter.addBreadcrumb({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Breadcrumb 1',
      })
      errorReporter.addBreadcrumb({
        timestamp: new Date().toISOString(),
        level: 'info',
        message: 'Breadcrumb 2',
      })

      expect(errorReporter.getBreadcrumbs()).toHaveLength(2)

      // Clear
      errorReporter.clearBreadcrumbs()

      expect(errorReporter.getBreadcrumbs()).toHaveLength(0)
    })
  })

  // =============================================================================
  // Error Filtering
  // =============================================================================

  describe('Error Filtering', () => {
    it('should filter errors matching ignoreErrors patterns', () => {
      // Add filter for specific error messages
      errorReporter.addFilter((error) => {
        return !error.message.includes('ignore this')
      })

      // This error should be ignored
      const ignoredError = new Error('Please ignore this error')
      errorReporter.captureError(ignoredError)

      // This error should be captured
      const capturedError = new Error('Capture this error')
      errorReporter.captureError(capturedError)

      // Only one error should be captured
      expect(mockReporter.capturedErrors).toHaveLength(1)
      expect(mockReporter.capturedErrors[0]?.error.message).toBe('Capture this error')
    })

    it('should apply sample rate filtering', () => {
      // Mock Math.random to return predictable values
      const originalRandom = Math.random
      let callCount = 0
      Math.random = vi.fn(() => {
        // Alternate between 0.3 (captured) and 0.7 (filtered)
        const value = callCount % 2 === 0 ? 0.3 : 0.7
        callCount++
        return value
      })

      // Add sample rate filter (50%)
      errorReporter.addFilter(() => Math.random() < 0.5)

      // Try to capture 10 errors
      for (let i = 0; i < 10; i++) {
        errorReporter.captureError(new Error(`Error ${i}`))
      }

      // Should capture approximately half (5)
      // With our alternating mock, exactly 5 will pass
      expect(mockReporter.capturedErrors).toHaveLength(5)

      // Restore original Math.random
      Math.random = originalRandom
    })
  })
})
