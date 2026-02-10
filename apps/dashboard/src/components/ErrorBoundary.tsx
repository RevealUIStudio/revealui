/**
 * ErrorBoundary Component
 *
 * React Error Boundary for catching and handling component errors
 */

import { logger } from '@revealui/core/observability/logger'
import React, { Component, type ReactNode } from 'react'

export interface ErrorBoundaryProps {
  children?: ReactNode
  fallback?: ReactNode | ((error: Error) => ReactNode)
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
  onReset?: () => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
    }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error
    logger.error('ErrorBoundary caught an error', error, {
      componentStack: errorInfo.componentStack,
    })

    // Call onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    // Reset error state if children change
    if (this.state.hasError && prevProps.children !== this.props.children) {
      this.setState({
        hasError: false,
        error: null,
      })
    }
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
    })

    if (this.props.onReset) {
      this.props.onReset()
    }
  }

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      // Render custom fallback if provided
      if (this.props.fallback) {
        if (typeof this.props.fallback === 'function') {
          return this.props.fallback(this.state.error)
        }
        return this.props.fallback
      }

      // Render default fallback UI
      return (
        <div
          role="alert"
          aria-live="assertive"
          className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
        >
          <h1 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-2">
            Something went wrong
          </h1>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            An error occurred while rendering this component.
          </p>

          {process.env.NODE_ENV === 'development' && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-4 mb-4">
              <p className="text-sm font-mono text-red-800 dark:text-red-200">
                {this.state.error.message}
              </p>
            </div>
          )}

          <button
            onClick={this.handleReset}
            type="button"
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded transition-colors"
          >
            Try Again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
