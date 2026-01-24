/**
 * Error Boundary component to catch React rendering errors
 * Prevents the entire app from crashing when markdown rendering fails
 */

import { Component, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
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

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error for debugging
    console.error('[ErrorBoundary] Caught error:', error)
    console.error('[ErrorBoundary] Error info:', errorInfo)

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default error UI
      return (
        <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
          <h1>Error Loading Content</h1>
          <p>An error occurred while rendering this content. This might be due to:</p>
          <ul>
            <li>Invalid markdown syntax</li>
            <li>Missing or corrupted file</li>
            <li>Rendering issue with content</li>
          </ul>
          {this.state.error && (
            <details
              style={{
                marginTop: '1rem',
                padding: '1rem',
                background: '#f5f5f5',
                borderRadius: '4px',
              }}
            >
              <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>Technical Details</summary>
              <pre
                style={{
                  marginTop: '0.5rem',
                  whiteSpace: 'pre-wrap',
                  fontSize: '0.875rem',
                }}
              >
                {this.state.error.message}
                {this.state.error.stack && `\n\n${this.state.error.stack}`}
              </pre>
            </details>
          )}
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null })
            }}
            type="button"
            style={{
              marginTop: '1rem',
              padding: '0.5rem 1rem',
              background: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Try Again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
