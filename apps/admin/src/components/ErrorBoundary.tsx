'use client';

/**
 * React Error Boundary for admin App
 *
 * Catches React errors and displays a fallback UI instead of crashing the app.
 * Integrates with Sentry for error reporting in production.
 */

import * as Sentry from '@sentry/nextjs';
import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, errorInfo: ErrorInfo, reset: () => void) => ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Send to Sentry (React surfaces errors in dev automatically)
    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
        },
      },
    });

    // Update state with error info
    this.setState({
      error,
      errorInfo,
    });
  }

  reset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback } = this.props;

    if (hasError && error && errorInfo) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback(error, errorInfo, this.reset);
      }

      // Default fallback UI
      return <DefaultErrorFallback error={error} errorInfo={errorInfo} reset={this.reset} />;
    }

    return children;
  }
}

/**
 * Default Error Fallback Component
 */
interface DefaultErrorFallbackProps {
  error: Error;
  errorInfo: ErrorInfo;
  reset: () => void;
}

function DefaultErrorFallback({ error, errorInfo, reset }: DefaultErrorFallbackProps) {
  const [showDetails, setShowDetails] = React.useState(false);

  return (
    <div
      style={{
        padding: '2rem',
        maxWidth: '800px',
        margin: '2rem auto',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div
        style={{
          backgroundColor: '#fee',
          border: '2px solid #c33',
          borderRadius: '8px',
          padding: '1.5rem',
        }}
      >
        <h1 style={{ margin: '0 0 1rem 0', color: '#c33' }}>⚠️ Something went wrong</h1>

        <p style={{ margin: '0 0 1rem 0', color: '#333' }}>
          The application encountered an unexpected error. This has been reported to our team.
        </p>

        <div style={{ marginBottom: '1rem' }}>
          <button
            type="button"
            onClick={reset}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginRight: '0.5rem',
            }}
          >
            Try Again
          </button>

          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#666',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Reload Page
          </button>
        </div>

        {process.env.NODE_ENV !== 'production' && (
          <>
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: 'transparent',
                color: '#666',
                border: '1px solid #ccc',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              {showDetails ? 'Hide' : 'Show'} Technical Details
            </button>

            {showDetails && (
              <div
                style={{
                  marginTop: '1rem',
                  padding: '1rem',
                  backgroundColor: '#f5f5f5',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                  overflow: 'auto',
                }}
              >
                <strong>Error:</strong>
                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {error.toString()}
                </pre>

                <strong style={{ display: 'block', marginTop: '1rem' }}>Stack Trace:</strong>
                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{error.stack}</pre>

                <strong style={{ display: 'block', marginTop: '1rem' }}>Component Stack:</strong>
                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {errorInfo.componentStack}
                </pre>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
