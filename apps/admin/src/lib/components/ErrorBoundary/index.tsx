/**
 * Error Boundary Component
 *
 * Catches React rendering errors and displays a user-friendly error message.
 * Prevents the entire application from crashing when a component fails.
 */

'use client';

import { Button } from '@revealui/presentation/server';
import { logger } from '@revealui/utils/logger';
import React, { Component, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
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

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error for debugging
    logger.error('ErrorBoundary caught an error', { error, errorInfo });

    // Update state with error info
    this.setState({
      error,
      errorInfo,
    });

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // You could also log to an error reporting service here
    // Example: logErrorToService(error, errorInfo)
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="my-16 p-6 border border-error/30 rounded-lg bg-error/10">
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold text-error mb-2">Something went wrong</h2>
              <p className="text-error">
                An unexpected error occurred while rendering this component. Please try refreshing
                the page. Contact support@revealui.com if this persists.
              </p>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-medium text-error mb-2">
                  Error Details (Development Only)
                </summary>
                <div className="mt-2 p-4 bg-error/15 rounded border border-error/30">
                  <p className="text-sm font-mono text-error mb-2">{this.state.error.toString()}</p>
                  {this.state.errorInfo && (
                    <pre className="text-xs text-error overflow-auto">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              </details>
            )}

            <Button
              type="button"
              variant="danger"
              className="self-start"
              onClick={this.handleReset}
            >
              Try Again
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook-based error boundary wrapper
 * For use in functional components
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode,
): React.ComponentType<P> {
  return function WrappedComponent(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}
