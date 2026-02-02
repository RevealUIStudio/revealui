/**
 * ErrorBoundary Component Tests
 *
 * Tests for React Error Boundary component
 */

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ErrorBoundary } from '../../components/ErrorBoundary'

// Mock console.error to avoid cluttering test output
const originalError = console.error
beforeEach(() => {
  console.error = vi.fn()
})

afterEach(() => {
  console.error = originalError
})

// Component that throws an error
const ThrowError = ({ shouldThrow = true }: { shouldThrow?: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error')
  }
  return <div>No error</div>
}

describe('ErrorBoundary', () => {
  describe('Normal Behavior', () => {
    it('should render children when no error', () => {
      render(
        <ErrorBoundary>
          <div>Test content</div>
        </ErrorBoundary>,
      )

      expect(screen.getByText('Test content')).toBeInTheDocument()
    })

    it('should render multiple children', () => {
      render(
        <ErrorBoundary>
          <div>Child 1</div>
          <div>Child 2</div>
        </ErrorBoundary>,
      )

      expect(screen.getByText('Child 1')).toBeInTheDocument()
      expect(screen.getByText('Child 2')).toBeInTheDocument()
    })

    it('should not interfere with normal rendering', () => {
      const { container } = render(
        <ErrorBoundary>
          <div className="test-class">Content</div>
        </ErrorBoundary>,
      )

      expect(container.querySelector('.test-class')).toBeInTheDocument()
    })
  })

  describe('Error Catching', () => {
    it('should catch errors from child components', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>,
      )

      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
    })

    it('should display error message', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>,
      )

      expect(screen.getByText(/error/i)).toBeInTheDocument()
    })

    it('should not render children after error', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
          <div>Should not render</div>
        </ErrorBoundary>,
      )

      expect(screen.queryByText('Should not render')).not.toBeInTheDocument()
    })

    it('should catch errors in nested components', () => {
      render(
        <ErrorBoundary>
          <div>
            <div>
              <ThrowError />
            </div>
          </div>
        </ErrorBoundary>,
      )

      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
    })
  })

  describe('Fallback UI', () => {
    it('should render default fallback UI', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>,
      )

      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    it('should display error heading', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>,
      )

      expect(screen.getByRole('heading')).toBeInTheDocument()
    })

    it('should show error details in development', () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'

      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>,
      )

      expect(screen.getByText(/test error/i)).toBeInTheDocument()

      process.env.NODE_ENV = originalEnv
    })

    it('should hide error details in production', () => {
      const originalEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'

      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>,
      )

      expect(screen.queryByText(/test error/i)).not.toBeInTheDocument()

      process.env.NODE_ENV = originalEnv
    })

    it('should render custom fallback when provided', () => {
      render(
        <ErrorBoundary fallback={<div>Custom error UI</div>}>
          <ThrowError />
        </ErrorBoundary>,
      )

      expect(screen.getByText('Custom error UI')).toBeInTheDocument()
    })

    it('should call fallback function with error', () => {
      const fallbackFn = vi.fn((error: Error) => <div>Error: {error.message}</div>)

      render(
        <ErrorBoundary fallback={fallbackFn}>
          <ThrowError />
        </ErrorBoundary>,
      )

      expect(fallbackFn).toHaveBeenCalled()
      expect(screen.getByText(/error: test error/i)).toBeInTheDocument()
    })
  })

  describe('Error Reporting', () => {
    it('should call onError callback when error occurs', () => {
      const onError = vi.fn()

      render(
        <ErrorBoundary onError={onError}>
          <ThrowError />
        </ErrorBoundary>,
      )

      expect(onError).toHaveBeenCalled()
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Test error' }),
        expect.any(Object), // Error info
      )
    })

    it('should log error to console', () => {
      const consoleError = vi.fn()
      console.error = consoleError

      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>,
      )

      expect(consoleError).toHaveBeenCalled()
    })

    it('should send error to monitoring service', () => {
      const reportError = vi.fn()

      render(
        <ErrorBoundary onError={reportError}>
          <ThrowError />
        </ErrorBoundary>,
      )

      expect(reportError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Test error' }),
        expect.anything(),
      )
    })
  })

  describe('Recovery', () => {
    it('should show retry button', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>,
      )

      expect(screen.getByRole('button', { name: /retry|try again/i })).toBeInTheDocument()
    })

    it('should reset error state when retry clicked', async () => {
      const { rerender } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>,
      )

      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()

      const retryButton = screen.getByRole('button', { name: /retry|try again/i })
      await retryButton.click()

      // After retry, re-render with non-throwing component
      rerender(
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>,
      )

      expect(screen.getByText('No error')).toBeInTheDocument()
    })

    it('should call onReset callback when reset', async () => {
      const onReset = vi.fn()

      render(
        <ErrorBoundary onReset={onReset}>
          <ThrowError />
        </ErrorBoundary>,
      )

      const retryButton = screen.getByRole('button', { name: /retry|try again/i })
      await retryButton.click()

      expect(onReset).toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    it('should have alert role for error message', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>,
      )

      const alert = screen.getByRole('alert')
      expect(alert).toBeInTheDocument()
    })

    it('should have accessible retry button', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>,
      )

      const button = screen.getByRole('button', { name: /retry|try again/i })
      expect(button).toHaveAccessibleName()
    })

    it('should be keyboard navigable', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>,
      )

      const button = screen.getByRole('button')
      expect(button).not.toHaveAttribute('tabindex', '-1')
    })

    it('should announce error to screen readers', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>,
      )

      const alert = screen.getByRole('alert')
      expect(alert).toHaveAttribute('aria-live', 'assertive')
    })
  })

  describe('Edge Cases', () => {
    it('should handle errors in useEffect hooks', () => {
      // Suppress console.error for this test
      const originalError = console.error
      console.error = vi.fn()

      const EffectError = () => {
        React.useEffect(() => {
          throw new Error('Effect error')
        }, [])
        return <div>Content</div>
      }

      render(
        <ErrorBoundary>
          <EffectError />
        </ErrorBoundary>,
      )

      // Note: Errors thrown in useEffect during initial render can be caught by error boundaries
      // in testing environments. In this case, the error boundary shows the error UI.
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()

      console.error = originalError
    })

    it('should handle errors in event handlers', () => {
      // Error boundaries don't catch errors in event handlers
      // This test documents the expected behavior

      const HandleClick = () => {
        const handleClick = () => {
          throw new Error('Click error')
        }
        return <button onClick={handleClick}>Click me</button>
      }

      render(
        <ErrorBoundary>
          <HandleClick />
        </ErrorBoundary>,
      )

      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('should handle null children', () => {
      render(<ErrorBoundary>{null}</ErrorBoundary>)

      // Should not crash
      expect(document.body).toBeTruthy()
    })

    it('should handle undefined children', () => {
      render(<ErrorBoundary>{undefined}</ErrorBoundary>)

      expect(document.body).toBeTruthy()
    })

    it('should handle multiple consecutive errors', () => {
      const { rerender } = render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>,
      )

      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()

      rerender(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>,
      )

      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
    })
  })

  describe('Integration', () => {
    it('should work with React Suspense', () => {
      const LazyComponent = React.lazy(() =>
        Promise.resolve({ default: () => <div>Lazy loaded</div> }),
      )

      render(
        <ErrorBoundary>
          <React.Suspense fallback={<div>Loading...</div>}>
            <LazyComponent />
          </React.Suspense>
        </ErrorBoundary>,
      )

      expect(screen.getByText(/loading/i)).toBeInTheDocument()
    })

    it('should work with error boundary nesting', () => {
      render(
        <ErrorBoundary fallback={<div>Outer error</div>}>
          <ErrorBoundary fallback={<div>Inner error</div>}>
            <ThrowError />
          </ErrorBoundary>
        </ErrorBoundary>,
      )

      // Inner boundary should catch the error
      expect(screen.getByText('Inner error')).toBeInTheDocument()
      expect(screen.queryByText('Outer error')).not.toBeInTheDocument()
    })
  })
})
