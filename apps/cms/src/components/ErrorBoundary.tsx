'use client';

/**
 * React Error Boundary for CMS App
 *
 * Catches React errors and displays a fallback UI instead of crashing the app.
 * Integrates with both Sentry (error reporting) and structured logging.
 */

import { logger } from '@revealui/core/observability/logger';
import * as Sentry from '@sentry/nextjs';
import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, errorInfo: ErrorInfo, reset: () => void) => ReactNode);
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
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
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Structured logging
    logger.error('ErrorBoundary caught an error', error, {
      componentStack: errorInfo.componentStack,
    });

    // Sentry error reporting
    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
        },
      },
    });

    this.setState({ error, errorInfo });

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
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
      if (typeof fallback === 'function') {
        return fallback(error, errorInfo, this.reset);
      }
      if (fallback) {
        return fallback;
      }
      return <DefaultErrorFallback error={error} errorInfo={errorInfo} reset={this.reset} />;
    }

    return children;
  }
}

/**
 * HOC wrapper for functional components.
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  fallback?: ReactNode,
): React.ComponentType<P> {
  return function ErrorBoundaryWrapper(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };
}

interface DefaultErrorFallbackProps {
  error: Error;
  errorInfo: ErrorInfo;
  reset: () => void;
}

function DefaultErrorFallback({ error, errorInfo, reset }: DefaultErrorFallbackProps) {
  const [showDetails, setShowDetails] = React.useState(false);

  return (
    <div className="my-16 p-6 border border-red-500 rounded-lg bg-red-50 dark:bg-red-950/20 dark:border-red-800">
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
            Something went wrong
          </h2>
          <p className="text-red-700 dark:text-red-300">
            An unexpected error occurred. This has been reported to our team. Please try refreshing
            the page or contact support@revealui.com if this persists.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={reset}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-zinc-600 text-white rounded hover:bg-zinc-700 transition-colors"
          >
            Reload Page
          </button>
        </div>

        {process.env.NODE_ENV !== 'production' && (
          <>
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="self-start px-4 py-2 text-sm text-zinc-600 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700 rounded"
            >
              {showDetails ? 'Hide' : 'Show'} Technical Details
            </button>

            {showDetails && (
              <div className="mt-2 p-4 bg-zinc-100 dark:bg-zinc-900 rounded text-sm overflow-auto">
                <strong>Error:</strong>
                <pre className="whitespace-pre-wrap break-words">{error.toString()}</pre>

                <strong className="block mt-4">Stack Trace:</strong>
                <pre className="whitespace-pre-wrap break-words">{error.stack}</pre>

                <strong className="block mt-4">Component Stack:</strong>
                <pre className="whitespace-pre-wrap break-words">{errorInfo.componentStack}</pre>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
