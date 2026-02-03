/**
 * React Error Boundary Components
 *
 * Catch and handle React component errors gracefully
 */

/// <reference types="react" />
import React, { Component, type ReactNode } from 'react'
import { logger } from '../observability/logger.js'

export interface ErrorInfo {
  componentStack: string
}

export interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode | ((error: Error, errorInfo: ErrorInfo) => ReactNode)
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  onReset?: () => void
  resetKeys?: unknown[]
  isolate?: boolean
}

export interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

/**
 * Error Boundary Component
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({
      errorInfo,
    })

    // Call error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    // Log error
    logger.error('Error caught by boundary', error, {
      componentStack: errorInfo.componentStack,
    })
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    const { resetKeys } = this.props

    // Reset error boundary if resetKeys change
    if (resetKeys && prevProps.resetKeys) {
      const hasResetKeyChanged = resetKeys.some((key, index) => {
        return key !== prevProps.resetKeys?.[index]
      })

      if (hasResetKeyChanged) {
        this.reset()
      }
    }
  }

  reset = (): void => {
    if (this.props.onReset) {
      this.props.onReset()
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })
  }

  render(): ReactNode {
    const { hasError, error, errorInfo } = this.state
    const { children, fallback, isolate } = this.props

    if (hasError && error) {
      // Render fallback
      if (typeof fallback === 'function') {
        return fallback(error, errorInfo!)
      }

      if (fallback) {
        return fallback
      }

      // Default error UI
      return (
        <DefaultErrorFallback
          error={error}
          errorInfo={errorInfo!}
          onReset={this.reset}
          isolate={isolate}
        />
      )
    }

    return children
  }
}

/**
 * Default Error Fallback Component
 */
interface DefaultErrorFallbackProps {
  error: Error
  errorInfo: ErrorInfo
  onReset: () => void
  isolate?: boolean
}

function DefaultErrorFallback({
  error,
  errorInfo,
  onReset,
  isolate,
}: DefaultErrorFallbackProps): React.ReactElement {
  if (isolate) {
    return (
      <div style={{ padding: '16px', border: '1px solid #f44336', borderRadius: '4px' }}>
        <p style={{ color: '#f44336', fontWeight: 'bold' }}>Something went wrong</p>
      </div>
    )
  }

  return (
    <div
      role="alert"
      style={{
        padding: '24px',
        maxWidth: '600px',
        margin: '40px auto',
        backgroundColor: '#fff',
        border: '1px solid #f44336',
        borderRadius: '8px',
      }}
    >
      <h2 style={{ color: '#f44336', marginTop: 0 }}>Something went wrong</h2>

      <p style={{ color: '#666' }}>An error occurred while rendering this component.</p>

      {process.env.NODE_ENV === 'development' && (
        <details style={{ marginTop: '16px' }}>
          <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>Error details</summary>

          <pre
            style={{
              marginTop: '8px',
              padding: '12px',
              backgroundColor: '#f5f5f5',
              borderRadius: '4px',
              overflow: 'auto',
              fontSize: '12px',
            }}
          >
            {error.toString()}
          </pre>

          <pre
            style={{
              marginTop: '8px',
              padding: '12px',
              backgroundColor: '#f5f5f5',
              borderRadius: '4px',
              overflow: 'auto',
              fontSize: '12px',
            }}
          >
            {errorInfo.componentStack}
          </pre>
        </details>
      )}

      <button
        onClick={onReset}
        style={{
          marginTop: '16px',
          padding: '8px 16px',
          backgroundColor: '#2196f3',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
        Try again
      </button>
    </div>
  )
}

/**
 * Error Boundary with retry
 */
export interface ErrorBoundaryWithRetryProps extends ErrorBoundaryProps {
  maxRetries?: number
  retryDelay?: number
}

export class ErrorBoundaryWithRetry extends Component<
  ErrorBoundaryWithRetryProps,
  ErrorBoundaryState & { retryCount: number }
> {
  private retryTimeout?: NodeJS.Timeout

  constructor(props: ErrorBoundaryWithRetryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({
      errorInfo,
    })

    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    // Auto-retry if under max retries
    const { maxRetries = 3, retryDelay = 1000 } = this.props

    if (this.state.retryCount < maxRetries) {
      this.retryTimeout = setTimeout(() => {
        this.setState((state) => ({
          hasError: false,
          error: null,
          errorInfo: null,
          retryCount: state.retryCount + 1,
        }))
      }, retryDelay)
    }
  }

  componentWillUnmount(): void {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout)
    }
  }

  reset = (): void => {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout)
    }

    if (this.props.onReset) {
      this.props.onReset()
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    })
  }

  render(): ReactNode {
    const { hasError, error, errorInfo, retryCount } = this.state
    const { children, fallback, maxRetries = 3 } = this.props

    if (hasError && error) {
      if (retryCount < maxRetries) {
        return (
          <div style={{ padding: '24px', textAlign: 'center' }}>
            <p>
              Retrying... (Attempt {retryCount + 1}/{maxRetries})
            </p>
          </div>
        )
      }

      if (typeof fallback === 'function') {
        return fallback(error, errorInfo!)
      }

      if (fallback) {
        return fallback
      }

      return <DefaultErrorFallback error={error} errorInfo={errorInfo!} onReset={this.reset} />
    }

    return children
  }
}

/**
 * withErrorBoundary HOC
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>,
): React.ComponentType<P> {
  const Wrapped = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  )

  Wrapped.displayName = `withErrorBoundary(${Component.displayName || Component.name})`

  return Wrapped
}

/**
 * useErrorHandler hook
 */
export function useErrorHandler(error?: Error | null): (error: Error) => void {
  const [, setError] = React.useState<Error | null>(null)

  React.useEffect(() => {
    if (error) {
      setError(() => {
        throw error
      })
    }
  }, [error])

  return React.useCallback((err: Error) => {
    setError(() => {
      throw err
    })
  }, [])
}

/**
 * Error types
 */
export class NetworkError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
  ) {
    super(message)
    this.name = 'NetworkError'
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthenticationError'
  }
}

export class NotFoundError extends Error {
  constructor(
    message: string,
    public resource?: string,
  ) {
    super(message)
    this.name = 'NotFoundError'
  }
}

/**
 * Error classification
 */
export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError || (error instanceof Error && error.name === 'NetworkError')
}

export function isValidationError(error: unknown): error is ValidationError {
  return (
    error instanceof ValidationError || (error instanceof Error && error.name === 'ValidationError')
  )
}

export function isAuthenticationError(error: unknown): error is AuthenticationError {
  return (
    error instanceof AuthenticationError ||
    (error instanceof Error && error.name === 'AuthenticationError')
  )
}

export function isNotFoundError(error: unknown): error is NotFoundError {
  return (
    error instanceof NotFoundError || (error instanceof Error && error.name === 'NotFoundError')
  )
}

/**
 * Error severity
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical'

export function getErrorSeverity(error: Error): ErrorSeverity {
  if (isAuthenticationError(error)) return 'critical'
  if (isNetworkError(error)) return 'high'
  if (isValidationError(error)) return 'low'
  if (isNotFoundError(error)) return 'medium'

  return 'medium'
}

/**
 * Should retry error
 */
export function shouldRetryError(error: Error): boolean {
  if (isNetworkError(error)) {
    const statusCode = (error as NetworkError).statusCode

    // Retry on 5xx errors and network failures
    return !statusCode || statusCode >= 500
  }

  return false
}
